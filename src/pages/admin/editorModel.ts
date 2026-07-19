import { classifyLine } from "./markdownEngine";

export type EditableLineParts = {
  prefix: string;
  text: string;
  toRaw: (value: string) => string;
};

export type EditorSelection = {
  startLine: number;
  startOffset: number;
  endLine: number;
  endOffset: number;
};

export type EditorMutation = {
  lines: string[];
  focusLine: number;
  caret: number;
};

export function editableLineParts(line: string): EditableLineParts {
  const type = classifyLine(line);
  if (type.type === "heading") {
    const prefix = `${"#".repeat(type.level)} `;
    return { prefix, text: type.text, toRaw: (value) => `${prefix}${value}` };
  }
  if (type.type === "quote") return { prefix: "> ", text: type.text, toRaw: (value) => `> ${value}` };
  if (type.type === "ul") {
    const prefix = `${" ".repeat(type.indent)}- `;
    return { prefix, text: type.text, toRaw: (value) => `${prefix}${value}` };
  }
  if (type.type === "ol") {
    const prefix = `${" ".repeat(type.indent)}${type.num}. `;
    return { prefix, text: type.text, toRaw: (value) => `${prefix}${value}` };
  }
  if (type.type === "checkbox") {
    const prefix = `${" ".repeat(type.indent)}- [${type.checked ? "x" : " "}] `;
    return { prefix, text: type.text, toRaw: (value) => `${prefix}${value}` };
  }
  return { prefix: "", text: line, toRaw: (value) => value };
}

function clampOffset(value: number, text: string) {
  return Math.max(0, Math.min(value, text.length));
}

function previousCharacterOffset(text: string, offset: number) {
  const safe = clampOffset(offset, text);
  if (safe >= 2 && /[\uDC00-\uDFFF]/.test(text[safe - 1]) && /[\uD800-\uDBFF]/.test(text[safe - 2])) return safe - 2;
  return Math.max(0, safe - 1);
}

function nextCharacterOffset(text: string, offset: number) {
  const safe = clampOffset(offset, text);
  if (safe + 1 < text.length && /[\uD800-\uDBFF]/.test(text[safe]) && /[\uDC00-\uDFFF]/.test(text[safe + 1])) return safe + 2;
  return Math.min(text.length, safe + 1);
}

export function replaceEditableSelection(
  sourceLines: string[],
  selection: EditorSelection,
  replacement = "",
): EditorMutation {
  const lines = sourceLines.length > 0 ? [...sourceLines] : [""];
  const startLine = Math.max(0, Math.min(selection.startLine, lines.length - 1));
  const endLine = Math.max(startLine, Math.min(selection.endLine, lines.length - 1));
  const startParts = editableLineParts(lines[startLine]);
  const endParts = editableLineParts(lines[endLine]);
  const startOffset = clampOffset(selection.startOffset, startParts.text);
  const endOffset = clampOffset(selection.endOffset, endParts.text);
  const normalizedReplacement = replacement.replace(/\r\n?/g, "\n");
  const replacementLines = normalizedReplacement.split("\n");
  const before = startParts.text.slice(0, startOffset);
  const after = endParts.text.slice(endOffset);

  if (replacementLines.length === 1) {
    const text = `${before}${replacementLines[0]}${after}`;
    lines.splice(startLine, endLine - startLine + 1, startParts.toRaw(text));
    return { lines, focusLine: startLine, caret: before.length + replacementLines[0].length };
  }

  const inserted = [
    startParts.toRaw(`${before}${replacementLines[0]}`),
    ...replacementLines.slice(1, -1),
    `${replacementLines[replacementLines.length - 1]}${after}`,
  ];
  lines.splice(startLine, endLine - startLine + 1, ...inserted);
  return {
    lines,
    focusLine: startLine + inserted.length - 1,
    caret: replacementLines[replacementLines.length - 1].length,
  };
}

export function deleteEditableSelection(
  sourceLines: string[],
  line: number,
  selectionStart: number,
  selectionEnd: number,
  direction: "backward" | "forward",
): EditorMutation {
  const lines = sourceLines.length > 0 ? sourceLines : [""];
  const index = Math.max(0, Math.min(line, lines.length - 1));
  const parts = editableLineParts(lines[index]);
  const start = clampOffset(Math.min(selectionStart, selectionEnd), parts.text);
  const end = clampOffset(Math.max(selectionStart, selectionEnd), parts.text);

  if (start !== end) {
    return replaceEditableSelection(lines, { startLine: index, startOffset: start, endLine: index, endOffset: end });
  }

  if (direction === "backward") {
    if (start > 0) {
      return replaceEditableSelection(lines, {
        startLine: index,
        startOffset: previousCharacterOffset(parts.text, start),
        endLine: index,
        endOffset: start,
      });
    }
    if (parts.prefix) {
      const next = [...lines];
      next[index] = parts.text;
      return { lines: next, focusLine: index, caret: 0 };
    }
    if (index > 0) {
      const previous = editableLineParts(lines[index - 1]);
      const next = [...lines];
      next.splice(index - 1, 2, previous.toRaw(`${previous.text}${parts.text}`));
      return { lines: next, focusLine: index - 1, caret: previous.text.length };
    }
  } else {
    if (start < parts.text.length) {
      return replaceEditableSelection(lines, {
        startLine: index,
        startOffset: start,
        endLine: index,
        endOffset: nextCharacterOffset(parts.text, start),
      });
    }
    if (index < lines.length - 1) {
      const nextParts = editableLineParts(lines[index + 1]);
      const next = [...lines];
      next.splice(index, 2, parts.toRaw(`${parts.text}${nextParts.text}`));
      return { lines: next, focusLine: index, caret: parts.text.length };
    }
  }

  return { lines: [...lines], focusLine: index, caret: start };
}

export function splitEditableLine(
  sourceLines: string[],
  line: number,
  selectionStart: number,
  selectionEnd: number,
): EditorMutation {
  const lines = sourceLines.length > 0 ? [...sourceLines] : [""];
  const index = Math.max(0, Math.min(line, lines.length - 1));
  const parts = editableLineParts(lines[index]);
  const start = clampOffset(Math.min(selectionStart, selectionEnd), parts.text);
  const end = clampOffset(Math.max(selectionStart, selectionEnd), parts.text);
  lines.splice(index, 1, parts.toRaw(parts.text.slice(0, start)), parts.text.slice(end));
  return { lines, focusLine: index + 1, caret: 0 };
}
