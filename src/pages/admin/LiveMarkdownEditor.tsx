import { useEffect, useMemo, useRef, useState } from "react";
import { Code, Heading2, Image, List, ListOrdered, Minus, Quote, SquareCheck, Table } from "lucide-react";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { getClipboardImageFiles, getImageAltText } from "./fileHelpers";
import { classifyLine, groupBlocks, type MarkdownBlock } from "./markdownEngine";
import type { UploadMarkdownAsset } from "./types";

function getCaretOffset(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return (el.textContent || "").length;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function placeCaret(el: HTMLElement, offset?: number | null) {
  const len = (el.textContent || "").length;
  const nextOffset = offset == null ? len : Math.max(0, Math.min(offset, len));
  const range = document.createRange();
  if (el.firstChild && el.firstChild.nodeType === 3) {
    range.setStart(el.firstChild, nextOffset);
  } else {
    range.selectNodeContents(el);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function editableLineParts(line: string) {
  const type = classifyLine(line);
  if (type.type === "heading") {
    const prefix = `${"#".repeat(type.level)} `;
    return { type, prefix, text: type.text, toRaw: (value: string) => `${prefix}${value}` };
  }
  if (type.type === "quote") return { type, prefix: "> ", text: type.text, toRaw: (value: string) => `> ${value}` };
  if (type.type === "ul") {
    const indent = " ".repeat(type.indent);
    return { type, prefix: `${indent}- `, text: type.text, toRaw: (value: string) => `${indent}- ${value}` };
  }
  if (type.type === "ol") {
    const indent = " ".repeat(type.indent);
    return { type, prefix: `${indent}${type.num}. `, text: type.text, toRaw: (value: string) => `${indent}${type.num}. ${value}` };
  }
  if (type.type === "checkbox") {
    const indent = " ".repeat(type.indent);
    const marker = `- [${type.checked ? "x" : " "}] `;
    return { type, prefix: `${indent}${marker}`, text: type.text, toRaw: (value: string) => `${indent}${marker}${value}` };
  }
  return { type, prefix: "", text: line, toRaw: (value: string) => value };
}

function RawLine({
  line,
  startLine,
  caretHint,
  onKeyDown,
  onBlurCommit,
}: {
  line: string;
  startLine: number;
  caretHint: number | null;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, line: number, toRaw: (value: string) => string) => void;
  onBlurCommit: (event: React.FocusEvent<HTMLDivElement>, line: number, toRaw: (value: string) => string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const parts = editableLineParts(line);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.focus();
    placeCaret(ref.current, caretHint);
  }, [caretHint]);

  return (
    <div className={rawLineFrameClass(line)}>
      {parts.prefix && <span className="select-none whitespace-pre font-mono text-[0.72em] font-semibold text-gray-300">{parts.prefix}</span>}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onKeyDown={(event) => onKeyDown(event, startLine, parts.toRaw)}
        onBlur={(event) => onBlurCommit(event, startLine, parts.toRaw)}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\n/g, " "));
        }}
        className={rawLineClass(line)}
      >
        {parts.text}
      </div>
    </div>
  );
}

function RawBlock({ text, type, onCommit }: { text: string; type: "code" | "table"; onCommit: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);
  return (
    <textarea
      ref={ref}
      defaultValue={text}
      onBlur={(event) => onCommit(event.target.value)}
      onInput={(event) => {
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      spellCheck={false}
      className={`admin-raw-block my-4 block w-full resize-none rounded-xl border px-4 py-3 font-mono text-[14px] leading-7 outline-none transition-colors ${type === "code" ? "border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-200 focus:bg-white" : "border-gray-200 bg-white text-gray-700 focus:border-indigo-200"}`}
    />
  );
}

function rawLineFrameClass(line: string) {
  const type = classifyLine(line);
  const base = "group -mx-2 flex items-baseline gap-2 rounded-lg border border-transparent px-2 transition-colors focus-within:border-indigo-100 focus-within:bg-indigo-50/25";
  if (type.type === "heading") return `${base} my-3`;
  if (type.type === "quote") return `${base} my-3 border-l-2 border-l-indigo-200 bg-indigo-50/20`;
  if (type.type === "ul" || type.type === "ol" || type.type === "checkbox") return `${base} my-1.5`;
  return `${base} my-1.5`;
}

function rawLineClass(line: string) {
  const type = classifyLine(line);
  if (type.type === "heading") {
    const size = type.level === 1 ? "text-[30px]" : type.level === 2 ? "text-2xl" : type.level === 3 ? "text-xl" : "text-base";
    return `min-w-0 flex-1 whitespace-pre-wrap break-words font-display font-extrabold text-gray-900 outline-none ${size}`;
  }
  if (type.type === "quote") return "min-w-0 flex-1 py-2 text-[15px] leading-7 text-gray-600 outline-none";
  if (type.type === "ul" || type.type === "ol" || type.type === "checkbox") return "min-w-0 flex-1 whitespace-pre-wrap break-words text-base leading-8 text-gray-700 outline-none";
  return "min-w-0 flex-1 whitespace-pre-wrap break-words text-base leading-8 text-gray-700 outline-none";
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
      <MarkdownRenderer content={markdown || "\u00a0"} className="admin-live-render" />
    </div>
  );
}

function LinePreview({ line, startLine, onFocus }: { line: string; startLine: number; onFocus: (line: number) => void }) {
  const c = classifyLine(line);
  if (c.type === "empty") return <div onClick={() => onFocus(startLine)} className="min-h-5 cursor-text">&nbsp;</div>;
  return <PreviewShell markdown={line} line={startLine} onFocus={onFocus} />;
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
  const [pasteUploadCount, setPasteUploadCount] = useState(0);
  const caretHintRef = useRef<number | null>(null);
  const lastFocusedRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const skipNextChangeRef = useRef(false);
  onChangeRef.current = onChange;

  useEffect(() => {
    const nextLines = (value || "").split("\n");
    caretHintRef.current = null;
    lastFocusedRef.current = null;
    setFocusLine(null);
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

  const commit = (nextLines: string[], nextFocus?: number | null, caret?: number | null) => {
    caretHintRef.current = caret ?? null;
    setLines(nextLines);
    if (nextFocus !== undefined) setFocusLine(nextFocus);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, startLine: number, toRaw: (value: string) => string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const offset = getCaretOffset(event.currentTarget);
      const text = event.currentTarget.textContent || "";
      const next = [...lines];
      next[startLine] = toRaw(text.slice(0, offset));
      next.splice(startLine + 1, 0, text.slice(offset));
      commit(next, startLine + 1, 0);
    } else if (event.key === "Backspace") {
      const offset = getCaretOffset(event.currentTarget);
      if (offset === 0 && startLine > 0) {
        event.preventDefault();
        const next = [...lines];
        const prevLen = next[startLine - 1].length;
        next[startLine - 1] += toRaw(event.currentTarget.textContent || "");
        next.splice(startLine, 1);
        commit(next, startLine - 1, prevLen);
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = [...lines];
      next[startLine] = toRaw(event.currentTarget.textContent || "");
      const target = startLine + (event.key === "ArrowUp" ? -1 : 1);
      commit(next, target >= 0 && target < next.length ? target : startLine, null);
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const handleBlurCommit = (event: React.FocusEvent<HTMLDivElement>, startLine: number, toRaw: (value: string) => string) => {
    const next = [...lines];
    next[startLine] = toRaw(event.currentTarget.textContent || "");
    setLines(next);
    setFocusLine((current) => (current === startLine ? null : current));
  };

  const applyLinePrefix = (mutate: (value: string) => string) => {
    const index = lastFocusedRef.current ?? Math.max(0, lines.length - 1);
    const next = [...lines];
    next[index] = mutate(next[index] || "");
    commit(next, index, next[index].length);
  };

  const insertBlock = (templateLines: string[]) => {
    const index = lastFocusedRef.current != null ? lastFocusedRef.current + 1 : lines.length;
    const next = [...lines];
    next.splice(index, 0, "", ...templateLines, "");
    commit(next, index + 1, templateLines[0]?.length ?? 0);
  };

  const replaceFirstMarkdown = (search: string, replacement: string) => {
    setLines((currentLines) => currentLines.join("\n").replace(search, replacement).split("\n"));
  };

  const handlePasteImages = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const images = getClipboardImageFiles(event.clipboardData);
    if (images.length === 0) return;
    event.preventDefault();
    const placeholders = images.map((_, index) => `![图片上传中 ${index + 1}](uploading://clipboard-image-${Date.now()}-${index})`);
    const index = focusLine ?? lines.length - 1;
    const next = [...lines];
    next.splice(index + 1, 0, ...placeholders);
    commit(next, index + 1, null);
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

  return (
    <div className="le-root rounded-none bg-white" onPasteCapture={handlePasteImages}>
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
      <div className="px-0 py-2 pb-16">
        {blocks.map((block) => {
          const focused = focusLine != null && focusLine >= block.startLine && focusLine <= block.endLine;
          if (block.type !== "line" && !focused) return <BlockPreview key={block.startLine} block={block} lines={lines} onFocus={setFocusLine} />;
          if (block.type !== "line" && focused) {
            return (
              <RawBlock
                key={`edit-${block.startLine}`}
                type={block.type}
                text={lines.slice(block.startLine, block.endLine + 1).join("\n")}
                onCommit={(value) => {
                  const next = [...lines];
                  next.splice(block.startLine, block.endLine - block.startLine + 1, ...value.split("\n"));
                  setLines(next);
                  setFocusLine(null);
                }}
              />
            );
          }
          const line = lines[block.startLine] || "";
          if (focusLine === block.startLine) return <RawLine key={`raw-${block.startLine}`} line={line} startLine={block.startLine} caretHint={caretHintRef.current} onKeyDown={handleKeyDown} onBlurCommit={handleBlurCommit} />;
          return <LinePreview key={block.startLine} line={line} startLine={block.startLine} onFocus={setFocusLine} />;
        })}
        <div onClick={() => commit([...lines, ""], lines.length, 0)} className="h-10 cursor-text" />
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
