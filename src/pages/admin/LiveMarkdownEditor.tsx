import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Code, Heading2, Image, List, ListOrdered, Minus, Quote, SquareCheck, Table } from "lucide-react";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { getClipboardImageFiles, getImageAltText } from "./fileHelpers";
import { deleteEditableSelection, editableLineParts, replaceEditableSelection, splitEditableLine, type EditorSelection } from "./editorModel";
import { classifyLine, groupBlocks, shouldRenderLinePreview, type MarkdownBlock } from "./markdownEngine";
import type { UploadMarkdownAsset } from "./types";

function getCaretOffset(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return (el.textContent || "").length;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.endContainer)) return (el.textContent || "").length;
  const preRange = range.cloneRange();
  try {
    preRange.selectNodeContents(el);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString().length;
  } catch {
    return (el.textContent || "").length;
  }
}

function getSelectionOffsets(el: HTMLElement) {
  const fallback = (el.textContent || "").length;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { start: fallback, end: fallback };
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return { start: fallback, end: fallback };
  const contents = document.createRange();
  contents.selectNodeContents(el);

  try {
    const startRange = contents.cloneRange();
    startRange.setEnd(range.startContainer, range.startOffset);
    const endRange = contents.cloneRange();
    endRange.setEnd(range.endContainer, range.endOffset);
    return { start: startRange.toString().length, end: endRange.toString().length };
  } catch {
    return { start: fallback, end: fallback };
  }
}

function getEditableLineElement(node: Node | null, root: HTMLElement) {
  const element = node instanceof Element ? node : node?.parentElement;
  const line = element?.closest<HTMLElement>("[data-editor-line]") ?? null;
  return line && root.contains(line) ? line : null;
}

function getOffsetWithinElement(el: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  try {
    range.selectNodeContents(el);
    range.setEnd(node, offset);
    return Math.max(0, Math.min(range.toString().length, (el.textContent || "").length));
  } catch {
    return (el.textContent || "").length;
  }
}

function getEditorSelection(root: HTMLElement): EditorSelection | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const startElement = getEditableLineElement(range.startContainer, root);
  const endElement = getEditableLineElement(range.endContainer, root);
  if (!startElement || !endElement) return null;
  const startLine = Number(startElement.dataset.editorLine);
  const endLine = Number(endElement.dataset.editorLine);
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return null;
  return {
    startLine,
    startOffset: getOffsetWithinElement(startElement, range.startContainer, range.startOffset),
    endLine,
    endOffset: getOffsetWithinElement(endElement, range.endContainer, range.endOffset),
  };
}

function isElementFullySelected(el: HTMLElement) {
  const { start, end } = getSelectionOffsets(el);
  return start === 0 && end === (el.textContent || "").length;
}

function selectElementContents(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaret(el: HTMLElement, offset?: number | null) {
  const len = (el.textContent || "").length;
  const nextOffset = offset == null ? len : Math.max(0, Math.min(offset, len));
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let remaining = nextOffset;
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  try {
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {
    el.focus();
  }
}

type InlineToken =
  | { type: "text"; raw: string; start: number; end: number }
  | { type: "strong" | "em" | "delete" | "code"; id: string; raw: string; markerOpen: string; markerClose: string; text: string; start: number; end: number; innerStart: number; innerEnd: number }
  | { type: "link"; id: string; raw: string; text: string; url: string; start: number; end: number; textStart: number; textEnd: number }
  | { type: "image"; id: string; raw: string; alt: string; src: string; start: number; end: number; altStart: number; altEnd: number };

function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /!\[([^\]]*)]\(([^)]+)\)|\[([^\]]+)]\(([^)]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|(^|[^*\w])\*([^*\n]+)\*(?!\*)/g;
  let cursor = 0;
  let count = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (start > cursor) tokens.push({ type: "text", raw: text.slice(cursor, start), start: cursor, end: start });
    const id = `t-${start}-${count++}`;
    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({ type: "image", id, raw, alt: match[1], src: match[2], start, end: start + raw.length, altStart: start + 2, altEnd: start + 2 + match[1].length });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({ type: "link", id, raw, text: match[3], url: match[4], start, end: start + raw.length, textStart: start + 1, textEnd: start + 1 + match[3].length });
    } else if (match[5] !== undefined) {
      tokens.push({ type: "code", id, raw, markerOpen: "`", markerClose: "`", text: match[5], start, end: start + raw.length, innerStart: start + 1, innerEnd: start + 1 + match[5].length });
    } else if (match[6] !== undefined) {
      tokens.push({ type: "strong", id, raw, markerOpen: "**", markerClose: "**", text: match[6], start, end: start + raw.length, innerStart: start + 2, innerEnd: start + 2 + match[6].length });
    } else if (match[7] !== undefined) {
      tokens.push({ type: "delete", id, raw, markerOpen: "~~", markerClose: "~~", text: match[7], start, end: start + raw.length, innerStart: start + 2, innerEnd: start + 2 + match[7].length });
    } else if (match[9] !== undefined) {
      const leading = match[8] ?? "";
      if (leading) tokens.push({ type: "text", raw: leading, start, end: start + leading.length });
      tokens.push({ type: "em", id, raw: raw.slice(leading.length), markerOpen: "*", markerClose: "*", text: match[9], start: start + leading.length, end: start + raw.length, innerStart: start + leading.length + 1, innerEnd: start + leading.length + 1 + match[9].length });
    }
    cursor = start + raw.length;
  }
  if (cursor < text.length) tokens.push({ type: "text", raw: text.slice(cursor), start: cursor, end: text.length });
  return tokens;
}

function tokenAtOffset(tokens: InlineToken[], offset: number) {
  const token = tokens.find((item) => item.type !== "text" && offset >= item.start && offset <= item.end);
  return token?.type === "text" ? null : token?.id ?? null;
}

function InlineTokenView({ token, active }: { token: InlineToken; active: boolean }) {
  if (token.type === "text") return <>{token.raw}</>;
  const className = active ? "le-md-token le-md-token-active" : "le-md-token";
  if (token.type === "link") {
    return (
      <span className={className}>
        <span className="le-md-marker">[</span><a className="le-md-link">{token.text}</a><span className="le-md-marker">]({token.url})</span>
      </span>
    );
  }
  if (token.type === "image") {
    return (
      <span className={className}>
        <span className="le-md-marker">![</span><span className="le-md-image-alt">{token.alt || "图片"}</span><span className="le-md-marker">]({token.src})</span>
      </span>
    );
  }
  const inner = token.type === "strong"
    ? <strong className="font-extrabold text-gray-900">{token.text}</strong>
    : token.type === "em"
      ? <em>{token.text}</em>
      : token.type === "delete"
        ? <del>{token.text}</del>
        : <code className="le-inline-code rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-[0.12rem] font-mono text-[0.86em] font-semibold text-indigo-700">{token.text}</code>;
  return (
    <span className={className}>
      <span className="le-md-marker">{token.markerOpen}</span>{inner}<span className="le-md-marker">{token.markerClose}</span>
    </span>
  );
}

function RawLine({
  line,
  startLine,
  caretHint,
  focusNonce,
  placeholder,
  onKeyDown,
  onFocusLine,
  onInputCommit,
  onBlurCommit,
  onPasteText,
  onDeleteInput,
}: {
  line: string;
  startLine: number;
  caretHint: number | null;
  focusNonce: number;
  placeholder?: string;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, line: number, toRaw: (value: string) => string) => void;
  onFocusLine: (line: number) => void;
  onInputCommit: (target: HTMLDivElement, line: number, toRaw: (value: string) => string) => void;
  onBlurCommit: (event: React.FocusEvent<HTMLDivElement>, line: number, toRaw: (value: string) => string) => void;
  onPasteText: (event: React.ClipboardEvent<HTMLDivElement>, line: number, toRaw: (value: string) => string) => void;
  onDeleteInput: (target: HTMLDivElement, line: number, direction: "backward" | "forward") => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const parts = editableLineParts(line);
  const lineType = classifyLine(line);
  const prefixIsStructural = lineType.type === "heading" || lineType.type === "quote";
  const visiblePrefix = lineType.type === "ul"
    ? `${" ".repeat(lineType.indent)}•`
    : lineType.type === "ol"
      ? `${" ".repeat(lineType.indent)}${lineType.num}.`
      : lineType.type === "checkbox"
        ? `${" ".repeat(lineType.indent)}${lineType.checked ? "☑" : "☐"}`
        : parts.prefix;
  const inlineTokens = useMemo(() => parseInlineTokens(parts.text), [parts.text]);
  const updateActiveToken = () => {
    if (!ref.current) return;
    setActiveTokenId(tokenAtOffset(inlineTokens, getCaretOffset(ref.current)));
  };
  useEffect(() => {
    if (focusNonce === 0) return;
    if (!ref.current) return;
    ref.current.focus();
    placeCaret(ref.current, caretHint);
    updateActiveToken();
  }, [caretHint, focusNonce]);

  return (
    <div className={rawLineFrameClass(line)}>
      {parts.prefix && (
        <span
          className={prefixIsStructural
            ? "pointer-events-none absolute right-full top-[0.3em] mr-2 select-none whitespace-pre font-mono text-[0.68em] font-semibold text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            : "le-list-prefix min-w-[1.1em] select-none whitespace-pre text-center text-[0.9em] font-semibold"}
        >
          {visiblePrefix}
        </span>
      )}
      <div
        key={line}
        ref={ref}
        contentEditable
        data-editor-line={startLine}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={() => {
          onFocusLine(startLine);
          window.requestAnimationFrame(updateActiveToken);
        }}
        onMouseUp={updateActiveToken}
        onKeyUp={updateActiveToken}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          const target = event.currentTarget;
          const offset = getCaretOffset(target);
          flushSync(() => {
            onInputCommit(target, startLine, parts.toRaw);
          });
          if (ref.current) placeCaret(ref.current, offset);
          updateActiveToken();
        }}
        onInput={(event) => {
          if (isComposingRef.current) return;
          const target = event.currentTarget;
          const offset = getCaretOffset(target);
          flushSync(() => {
            onInputCommit(target, startLine, parts.toRaw);
          });
          if (ref.current) placeCaret(ref.current, offset);
          updateActiveToken();
        }}
        onKeyDown={(event) => {
          if (isComposingRef.current || event.nativeEvent.isComposing) return;
          onKeyDown(event, startLine, parts.toRaw);
          window.requestAnimationFrame(updateActiveToken);
        }}
        onBeforeInput={(event) => {
          if (isComposingRef.current) return;
          const inputType = (event.nativeEvent as InputEvent).inputType;
          if (inputType !== "deleteContentBackward" && inputType !== "deleteContentForward") return;
          event.preventDefault();
          onDeleteInput(event.currentTarget, startLine, inputType === "deleteContentBackward" ? "backward" : "forward");
        }}
        onBlur={(event) => onBlurCommit(event, startLine, parts.toRaw)}
        onPaste={(event) => onPasteText(event, startLine, parts.toRaw)}
        className={rawLineClass(line)}
      >
        {inlineTokens.map((token, index) => <InlineTokenView key={index} token={token} active={token.type !== "text" && token.id === activeTokenId} />)}
      </div>
    </div>
  );
}

function RawBlock({
  text,
  type,
  focusNonce,
  onFocusBlock,
  onBlurBlock,
  onChangeValue,
  onSelectAll,
}: {
  text: string;
  type: "code" | "table";
  focusNonce: number;
  onFocusBlock: () => void;
  onBlurBlock: () => void;
  onChangeValue: (value: string) => void;
  onSelectAll: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = () => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  useEffect(() => {
    resize();
  }, [text]);
  useEffect(() => {
    if (focusNonce === 0) return;
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [focusNonce]);
  return (
    <textarea
      ref={ref}
      value={text}
      onFocus={onFocusBlock}
      onBlur={onBlurBlock}
      onChange={(event) => onChangeValue(event.target.value)}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey)
          && event.key.toLowerCase() === "a"
          && event.currentTarget.selectionStart === 0
          && event.currentTarget.selectionEnd === event.currentTarget.value.length
        ) {
          event.preventDefault();
          onSelectAll();
        }
      }}
      onInput={(event) => {
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      spellCheck={false}
      className={`admin-raw-block my-4 block w-full resize-none rounded-xl border px-4 py-3 font-mono text-[14px] leading-7 outline-none transition-colors ${type === "code" ? "border-slate-200 bg-slate-50 text-slate-800 focus:border-slate-300 focus:bg-white" : "border-gray-200 bg-white text-gray-700 focus:border-gray-300"}`}
    />
  );
}

const headingClasses: Record<number, { size: string; spacing: string; color: string }> = {
  1: { size: "text-3xl md:text-4xl", spacing: "mt-0 mb-8", color: "text-gray-900" },
  2: { size: "text-2xl md:text-3xl", spacing: "mt-12 mb-5 border-b border-gray-100 pb-3", color: "text-gray-900" },
  3: { size: "text-xl md:text-2xl", spacing: "mt-10 mb-4", color: "text-gray-900" },
  4: { size: "text-lg md:text-xl", spacing: "mt-8 mb-3", color: "text-gray-900" },
  5: { size: "text-base md:text-lg", spacing: "mt-6 mb-2", color: "text-gray-900" },
  6: { size: "text-sm md:text-base", spacing: "mt-6 mb-2", color: "uppercase text-gray-500" },
};

function rawLineFrameClass(line: string) {
  const type = classifyLine(line);
  const base = "group relative flex items-baseline gap-2 rounded-md border border-transparent transition-colors";
  if (type.type === "empty") return `${base} my-0 min-h-3 focus-within:min-h-8`;
  if (type.type === "heading") return `${base} ${headingClasses[type.level]?.spacing ?? "my-3"}`;
  if (type.type === "quote") return `${base} my-6 border-l-4 border-l-indigo-300 bg-indigo-50/60 py-3 pl-5 pr-4`;
  if (type.type === "ul" || type.type === "ol" || type.type === "checkbox") return `${base} my-3`;
  return `${base} my-5`;
}

function rawLineClass(line: string) {
  const type = classifyLine(line);
  if (type.type === "empty") return "le-editable-line min-w-0 min-h-3 flex-1 whitespace-pre-wrap break-words text-lg leading-3 text-gray-700 outline-none focus:min-h-8 focus:leading-8";
  if (type.type === "heading") {
    const heading = headingClasses[type.level] ?? headingClasses[6];
    return `le-editable-line min-w-0 min-h-[1.2em] flex-1 whitespace-pre-wrap break-words font-display font-black tracking-tight outline-none ${heading.color} ${heading.size}`;
  }
  if (type.type === "quote") return "le-editable-line min-w-0 min-h-[1.75rem] flex-1 text-lg leading-8 text-gray-700 outline-none";
  if (type.type === "ul" || type.type === "ol" || type.type === "checkbox") return "le-editable-line min-w-0 min-h-[2rem] flex-1 whitespace-pre-wrap break-words text-lg leading-8 text-gray-700 outline-none";
  return "le-editable-line min-w-0 min-h-[2rem] flex-1 whitespace-pre-wrap break-words text-lg leading-8 text-gray-700 outline-none";
}

function PreviewShell({ markdown, line, onFocus }: { markdown: string; line: number; onFocus: (line: number) => void }) {
  return (
    <div
      className="admin-live-preview cursor-text"
      onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onFocus(line);
      }}
    >
      <MarkdownRenderer content={markdown || "\u00a0"} className="admin-live-render reading-markdown" />
    </div>
  );
}

function BlockPreview({ block, lines, onFocus }: { block: MarkdownBlock; lines: string[]; onFocus: (line: number) => void }) {
  return <PreviewShell markdown={lines.slice(block.startLine, block.endLine + 1).join("\n")} line={block.startLine} onFocus={onFocus} />;
}

export function LiveMarkdownEditor({
  value,
  onChange,
  docKey,
  accent = "blog",
  uploadMarkdownAsset,
}: {
  value: string;
  onChange: (value: string) => void;
  docKey: string;
  accent?: "blog" | "docs";
  uploadMarkdownAsset: UploadMarkdownAsset;
}) {
  const [lines, setLines] = useState(() => (value || "").split("\n"));
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [pasteUploadCount, setPasteUploadCount] = useState(0);
  const caretHintRef = useRef<number | null>(null);
  const lastFocusedRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const skipNextChangeRef = useRef(false);
  const lastDocKeyRef = useRef(docKey);
  const articleRef = useRef<HTMLDivElement | null>(null);
  const wholeEditorSelectedRef = useRef(false);
  const linesRef = useRef(lines);
  const historyRef = useRef<{ past: string[][]; future: string[][] }>({ past: [], future: [] });
  const historyGroupRef = useRef<{ key: string; time: number } | null>(null);
  linesRef.current = lines;
  onChangeRef.current = onChange;

  useEffect(() => {
    const nextLines = (value || "").split("\n");
    const docChanged = lastDocKeyRef.current !== docKey;
    lastDocKeyRef.current = docKey;
    if (docChanged) {
      caretHintRef.current = null;
      lastFocusedRef.current = null;
      wholeEditorSelectedRef.current = false;
      historyRef.current = { past: [], future: [] };
      historyGroupRef.current = null;
      setFocusLine(null);
      setFocusNonce(0);
    }
    setLines((current) => {
      if (current.join("\n") === nextLines.join("\n")) return current;
      skipNextChangeRef.current = true;
      return nextLines;
    });
  }, [docKey, value]);

  useEffect(() => {
    if (skipNextChangeRef.current) {
      skipNextChangeRef.current = false;
      return;
    }
    onChangeRef.current(lines.join("\n"));
  }, [lines]);

  useEffect(() => {
    if (focusLine != null) lastFocusedRef.current = focusLine;
  }, [focusLine]);

  const blocks = useMemo(() => groupBlocks(lines), [lines]);
  const editorIsEmpty = lines.length === 1 && lines[0] === "";

  const rememberCurrentState = (groupKey?: string) => {
    const now = Date.now();
    const currentGroup = historyGroupRef.current;
    if (groupKey && currentGroup?.key === groupKey && now - currentGroup.time < 1000) {
      historyGroupRef.current = { key: groupKey, time: now };
      return;
    }
    const current = [...linesRef.current];
    const past = historyRef.current.past;
    const previous = past[past.length - 1];
    if (!previous || previous.join("\n") !== current.join("\n")) {
      historyRef.current.past = [...past.slice(-99), current];
    }
    historyRef.current.future = [];
    historyGroupRef.current = groupKey ? { key: groupKey, time: now } : null;
  };

  const commit = (
    updater: string[] | ((current: string[]) => string[]),
    nextFocus?: number | null,
    caret?: number | null,
  ) => {
    caretHintRef.current = caret ?? null;
    setLines((current) => (typeof updater === "function" ? updater(current) : updater));
    if (nextFocus !== undefined) {
      setFocusLine(nextFocus);
      setFocusNonce((nonce) => nonce + 1);
    }
  };

  const selectWholeEditor = () => {
    if (!articleRef.current) return;
    wholeEditorSelectedRef.current = true;
    selectElementContents(articleRef.current);
  };

  const replaceWholeEditorSelection = (text: string) => {
    const normalized = text.replace(/\r\n?/g, "\n");
    const next = normalized.split("\n");
    if (next.join("\n") !== linesRef.current.join("\n")) rememberCurrentState();
    wholeEditorSelectedRef.current = false;
    window.getSelection()?.removeAllRanges();
    commit(next.length > 0 ? next : [""], next.length - 1, next[next.length - 1]?.length ?? 0);
  };

  const restoreHistory = (direction: "undo" | "redo") => {
    const history = historyRef.current;
    const source = direction === "undo" ? history.past : history.future;
    const target = source[source.length - 1];
    if (!target) return;
    const current = [...linesRef.current];
    if (direction === "undo") {
      history.past = source.slice(0, -1);
      history.future = [...history.future, current];
    } else {
      history.future = source.slice(0, -1);
      history.past = [...history.past, current];
    }
    historyGroupRef.current = null;
    wholeEditorSelectedRef.current = false;
    window.getSelection()?.removeAllRanges();
    const lastLine = Math.max(0, target.length - 1);
    commit([...target], lastLine, target[lastLine]?.length ?? 0);
  };

  const applyMutation = (mutation: { lines: string[]; focusLine: number; caret: number }) => {
    if (mutation.lines.join("\n") === linesRef.current.join("\n")) return;
    rememberCurrentState();
    wholeEditorSelectedRef.current = false;
    window.getSelection()?.removeAllRanges();
    commit(mutation.lines, mutation.focusLine, mutation.caret);
  };

  const deleteSelection = (selection: EditorSelection, direction: "backward" | "forward") => {
    if (selection.startLine === selection.endLine) {
      applyMutation(deleteEditableSelection(
        linesRef.current,
        selection.startLine,
        selection.startOffset,
        selection.endOffset,
        direction,
      ));
      return;
    }
    applyMutation(replaceEditableSelection(linesRef.current, selection));
  };

  const handleEditorKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === "z") {
      event.preventDefault();
      event.stopPropagation();
      restoreHistory(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (event.ctrlKey && !event.metaKey && key === "y") {
      event.preventDefault();
      event.stopPropagation();
      restoreHistory("redo");
      return;
    }
    if (!wholeEditorSelectedRef.current && (event.key === "Backspace" || event.key === "Delete") && articleRef.current) {
      const selection = getEditorSelection(articleRef.current);
      if (selection) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelection(selection, event.key === "Backspace" ? "backward" : "forward");
        return;
      }
    }
    if (!wholeEditorSelectedRef.current) return;

    if ((event.metaKey || event.ctrlKey) && ["a", "c", "x"].includes(key)) {
      if (key === "a") {
        event.preventDefault();
        selectWholeEditor();
      }
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      event.stopPropagation();
      replaceWholeEditorSelection("");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      replaceWholeEditorSelection("");
      return;
    }

    if (["ArrowLeft", "ArrowUp", "Home"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      wholeEditorSelectedRef.current = false;
      window.getSelection()?.removeAllRanges();
      commit(lines, 0, 0);
      return;
    }

    if (["ArrowRight", "ArrowDown", "End"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      wholeEditorSelectedRef.current = false;
      window.getSelection()?.removeAllRanges();
      const lastLine = Math.max(0, lines.length - 1);
      commit(lines, lastLine, lines[lastLine]?.length ?? 0);
      return;
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      replaceWholeEditorSelection(event.key);
    }
  };

  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!wholeEditorSelectedRef.current) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", lines.join("\n"));
  };

  const handleCut = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!wholeEditorSelectedRef.current) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", lines.join("\n"));
    replaceWholeEditorSelection("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, startLine: number, toRaw: (value: string) => string) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && isElementFullySelected(event.currentTarget)) {
      event.preventDefault();
      selectWholeEditor();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selection = getSelectionOffsets(event.currentTarget);
      applyMutation(splitEditableLine(linesRef.current, startLine, selection.start, selection.end));
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const selection = getSelectionOffsets(event.currentTarget);
      deleteSelection(
        { startLine, startOffset: selection.start, endLine: startLine, endOffset: selection.end },
        event.key === "Backspace" ? "backward" : "forward",
      );
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const text = event.currentTarget.textContent || "";
      const target = startLine + (event.key === "ArrowUp" ? -1 : 1);
      commit(
        (current) => {
          const next = [...current];
          next[startLine] = toRaw(text);
          return next;
        },
        target >= 0 && target < lines.length ? target : startLine,
        null,
      );
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const handleDeleteInput = (target: HTMLDivElement, startLine: number, direction: "backward" | "forward") => {
    const selection = getSelectionOffsets(target);
    deleteSelection({ startLine, startOffset: selection.start, endLine: startLine, endOffset: selection.end }, direction);
  };

  const handleBlurCommit = (event: React.FocusEvent<HTMLDivElement>, startLine: number, toRaw: (value: string) => string) => {
    const text = event.currentTarget.textContent || "";
    const raw = toRaw(text);
    if (linesRef.current[startLine] !== raw) rememberCurrentState(`typing:${startLine}`);
    setLines((current) => {
      const next = [...current];
      next[startLine] = raw;
      return next;
    });
    setFocusLine((current) => (current === startLine ? null : current));
  };

  const handleInputCommit = (target: HTMLDivElement, startLine: number, toRaw: (value: string) => string) => {
    const raw = toRaw(target.textContent || "");
    if (linesRef.current[startLine] !== raw) rememberCurrentState(`typing:${startLine}`);
    setLines((current) => {
      if (current[startLine] === raw) return current;
      const next = [...current];
      next[startLine] = raw;
      return next;
    });
  };

  const handlePasteText = (event: React.ClipboardEvent<HTMLDivElement>, startLine: number, toRaw: (value: string) => string) => {
    const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    if (!text) return;
    event.preventDefault();
    rememberCurrentState();

    if (!text.includes("\n")) {
      document.execCommand("insertText", false, text);
      return;
    }

    const selection = getSelectionOffsets(event.currentTarget);
    const currentText = event.currentTarget.textContent || "";
    const beforeText = currentText.slice(0, selection.start);
    const afterText = currentText.slice(selection.end);
    const pastedLines = text.split("\n");
    const replacement = beforeText || afterText
      ? [
          toRaw(`${beforeText}${pastedLines[0]}`),
          ...pastedLines.slice(1, -1),
          `${pastedLines[pastedLines.length - 1]}${afterText}`,
        ]
      : pastedLines;
    commit(
      (current) => {
        const next = [...current];
        next.splice(startLine, 1, ...replacement);
        return next;
      },
      startLine + replacement.length - 1,
      pastedLines[pastedLines.length - 1].length,
    );
  };

  const applyLinePrefix = (mutate: (value: string) => string) => {
    const index = lastFocusedRef.current ?? Math.max(0, lines.length - 1);
    const nextValue = mutate(lines[index] || "");
    rememberCurrentState();
    commit(
      (current) => {
        const next = [...current];
        next[index] = nextValue;
        return next;
      },
      index,
      nextValue.length,
    );
  };

  const insertBlock = (templateLines: string[]) => {
    const index = lastFocusedRef.current != null ? lastFocusedRef.current + 1 : lines.length;
    rememberCurrentState();
    commit(
      (current) => {
        const next = [...current];
        next.splice(index, 0, "", ...templateLines, "");
        return next;
      },
      index + 1,
      templateLines[0]?.length ?? 0,
    );
  };

  const replaceFirstMarkdown = (search: string, replacement: string) => {
    setLines((currentLines) => currentLines.join("\n").replace(search, replacement).split("\n"));
  };

  const replaceBlockLines = (block: MarkdownBlock, value: string) => {
    if (linesRef.current.slice(block.startLine, block.endLine + 1).join("\n") !== value) {
      rememberCurrentState(`block:${block.startLine}`);
    }
    setLines((current) => {
      const next = [...current];
      next.splice(block.startLine, block.endLine - block.startLine + 1, ...value.split("\n"));
      return next;
    });
  };

  const handlePasteImages = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const images = getClipboardImageFiles(event.clipboardData);
    if (images.length === 0) return;
    event.preventDefault();
    const placeholders = images.map((_, index) => `![图片上传中 ${index + 1}](uploading://clipboard-image-${Date.now()}-${index})`);
    const replacingWholeEditor = wholeEditorSelectedRef.current;
    const index = replacingWholeEditor ? -1 : focusLine ?? lines.length - 1;
    rememberCurrentState();
    wholeEditorSelectedRef.current = false;
    window.getSelection()?.removeAllRanges();
    commit(
      (current) => {
        if (replacingWholeEditor) return placeholders;
        const next = [...current];
        next.splice(index + 1, 0, ...placeholders);
        return next;
      },
      replacingWholeEditor ? 0 : index + 1,
      null,
    );
    setPasteUploadCount((count) => count + images.length);

    await Promise.all(images.map(async (file, index) => {
      try {
        const url = await uploadMarkdownAsset(file);
        replaceFirstMarkdown(placeholders[index], `![${getImageAltText(file, index)}](${url})`);
      } catch (error) {
        replaceFirstMarkdown(placeholders[index], `<!-- 图片上传失败：${file.name || `clipboard-image-${index + 1}`} -->`);
        alert(error instanceof Error ? error.message : "图片上传失败");
      } finally {
        setPasteUploadCount((count) => Math.max(0, count - 1));
      }
    }));
  };

  const handlePasteCapture = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (getClipboardImageFiles(event.clipboardData).length > 0) {
      void handlePasteImages(event);
      return;
    }
    if (!wholeEditorSelectedRef.current) return;
    const text = event.clipboardData.getData("text/plain");
    event.preventDefault();
    event.stopPropagation();
    replaceWholeEditorSelection(text);
  };

  return (
    <div
      className={`le-root reader-live-editor reader-live-editor-${accent} rounded-none bg-white`}
      onCopyCapture={handleCopy}
      onCutCapture={handleCut}
      onKeyDownCapture={handleEditorKeyDownCapture}
      onMouseDownCapture={() => { wholeEditorSelectedRef.current = false; }}
      onPasteCapture={handlePasteCapture}
    >
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-100 bg-white/90 px-1 py-1.5 backdrop-blur">
        <ToolbarButton title="标题" icon={<Heading2 />} onClick={() => applyLinePrefix((text) => `## ${text.replace(/^#{1,6}\s+/, "") || "标题"}`)} />
        <ToolbarButton title="引用" icon={<Quote />} onClick={() => applyLinePrefix((text) => `> ${text.replace(/^>\s?/, "")}`)} />
        <ToolbarButton title="无序列表" icon={<List />} onClick={() => applyLinePrefix((text) => `- ${text.replace(/^[-*+]\s+/, "")}`)} />
        <ToolbarButton title="有序列表" icon={<ListOrdered />} onClick={() => applyLinePrefix((text) => `1. ${text.replace(/^\d+\.\s+/, "")}`)} />
        <ToolbarButton title="待办" icon={<SquareCheck />} onClick={() => applyLinePrefix((text) => `- [ ] ${text.replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")}`)} />
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <ToolbarButton title="代码块" icon={<Code />} onClick={() => insertBlock(["```js", "", "```"])} />
        <ToolbarButton title="表格" icon={<Table />} onClick={() => insertBlock(["| 列 A | 列 B |", "| --- | --- |", "| 内容 | 内容 |"])} />
        <ToolbarButton title="图片" icon={<Image />} onClick={() => insertBlock(["![说明文字](placeholder-image)"])} />
        <ToolbarButton title="分割线" icon={<Minus />} onClick={() => insertBlock(["---"])} />
        {pasteUploadCount > 0 && <span className="ml-auto pr-2 font-mono text-[11px] font-bold text-amber-600">正在上传 {pasteUploadCount} 张图片</span>}
      </div>
      <div ref={articleRef} className="min-h-[240px] px-0 py-2 pb-16">
        {blocks.map((block) => {
          const focused = focusLine != null && focusLine >= block.startLine && focusLine <= block.endLine;
          if (block.type !== "line") {
            if (!focused) return <BlockPreview key={`${block.type}-${block.startLine}`} block={block} lines={lines} onFocus={(line) => commit(lines, line, null)} />;
            return (
              <RawBlock
                key={`${block.type}-${block.startLine}`}
                type={block.type}
                text={lines.slice(block.startLine, block.endLine + 1).join("\n")}
                focusNonce={focusNonce}
                onFocusBlock={() => setFocusLine(block.startLine)}
                onBlurBlock={() => setFocusLine((current) => (current != null && current >= block.startLine && current <= block.endLine ? null : current))}
                onChangeValue={(value) => replaceBlockLines(block, value)}
                onSelectAll={() => {
                  selectWholeEditor();
                }}
              />
            );
          }
          const line = lines[block.startLine] || "";
          if (!focused && shouldRenderLinePreview(line)) {
            return (
              <PreviewShell
                key={`preview-${block.startLine}`}
                markdown={line}
                line={block.startLine}
                onFocus={(line) => commit(lines, line, null)}
              />
            );
          }
          return (
            <RawLine
              key={`raw-${block.startLine}`}
              line={line}
              startLine={block.startLine}
              caretHint={caretHintRef.current}
              focusNonce={focusLine === block.startLine ? focusNonce : 0}
              placeholder={editorIsEmpty ? "开始输入内容…" : undefined}
              onFocusLine={setFocusLine}
              onInputCommit={handleInputCommit}
              onKeyDown={handleKeyDown}
              onBlurCommit={handleBlurCommit}
              onPasteText={handlePasteText}
              onDeleteInput={handleDeleteInput}
            />
          );
        })}
        {editorIsEmpty && (
          <div className="pointer-events-none -mt-3 flex items-center gap-2 text-[11px] text-gray-300">
            <span>内容已清空</span>
            <span className="rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 font-mono">⌘ Z 撤销</span>
          </div>
        )}
        <div
          onClick={() => {
            rememberCurrentState();
            commit((current) => [...current, ""], lines.length, 0);
          }}
          className="h-10 cursor-text"
        />
      </div>
    </div>
  );
}

function ToolbarButton({ icon, title, onClick }: { icon: React.ReactElement<{ className?: string }>; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100">
      {icon && { ...icon, props: { ...icon.props, className: "h-[15px] w-[15px]" } }}
    </button>
  );
}
