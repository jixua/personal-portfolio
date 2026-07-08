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
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, line: number) => void;
  onBlurCommit: (event: React.FocusEvent<HTMLDivElement>, line: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.focus();
    placeCaret(ref.current, caretHint);
  }, [caretHint]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={(event) => onKeyDown(event, startLine)}
      onBlur={(event) => onBlurCommit(event, startLine)}
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\n/g, " "));
      }}
      className={rawLineClass(line)}
    >
      {line}
    </div>
  );
}

function RawBlock({ text, onCommit }: { text: string; onCommit: (value: string) => void }) {
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
      className="my-3 block w-full resize-none rounded-xl border border-gray-200 bg-[#1e2430] px-4 py-3 font-mono text-[13px] leading-7 text-[#dbe2f0] outline-none"
    />
  );
}

function rawLineClass(line: string) {
  const type = classifyLine(line);
  if (type.type === "heading") {
    const size = type.level === 1 ? "text-[30px]" : type.level === 2 ? "text-2xl" : type.level === 3 ? "text-xl" : "text-base";
    return `my-3 min-h-[1.4em] whitespace-pre-wrap break-words font-display font-extrabold text-gray-900 outline-none ${size}`;
  }
  if (type.type === "quote") return "my-3 min-h-[1.4em] rounded-r-lg bg-gray-50 px-4 py-2 text-[15px] leading-7 text-gray-600 outline-none";
  return "my-2 min-h-[1.4em] whitespace-pre-wrap break-words text-base leading-8 text-gray-700 outline-none";
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
  onChangeRef.current = onChange;

  useEffect(() => {
    setLines((value || "").split("\n"));
    setFocusLine(null);
  }, [docKey]);

  useEffect(() => {
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, startLine: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const offset = getCaretOffset(event.currentTarget);
      const text = event.currentTarget.textContent || "";
      const next = [...lines];
      next[startLine] = text.slice(0, offset);
      next.splice(startLine + 1, 0, text.slice(offset));
      commit(next, startLine + 1, 0);
    } else if (event.key === "Backspace") {
      const offset = getCaretOffset(event.currentTarget);
      if (offset === 0 && startLine > 0) {
        event.preventDefault();
        const next = [...lines];
        const prevLen = next[startLine - 1].length;
        next[startLine - 1] += event.currentTarget.textContent || "";
        next.splice(startLine, 1);
        commit(next, startLine - 1, prevLen);
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = [...lines];
      next[startLine] = event.currentTarget.textContent || "";
      const target = startLine + (event.key === "ArrowUp" ? -1 : 1);
      commit(next, target >= 0 && target < next.length ? target : startLine, null);
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const handleBlurCommit = (event: React.FocusEvent<HTMLDivElement>, startLine: number) => {
    const next = [...lines];
    next[startLine] = event.currentTarget.textContent || "";
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
