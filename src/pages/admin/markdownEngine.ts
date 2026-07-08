export type MarkdownBlock =
  | { type: "line"; startLine: number; endLine: number }
  | { type: "code"; startLine: number; endLine: number }
  | { type: "table"; startLine: number; endLine: number };

export type ClassifiedLine =
  | { type: "empty" }
  | { type: "heading"; level: number; text: string }
  | { type: "quote"; text: string }
  | { type: "hr" }
  | { type: "checkbox"; indent: number; checked: boolean; text: string }
  | { type: "ul"; indent: number; text: string }
  | { type: "ol"; indent: number; num: string; text: string }
  | { type: "image"; alt: string; src: string }
  | { type: "paragraph"; text: string };

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderInlineHTML(raw: string) {
  if (!raw) return "";
  let value = escapeHtml(raw);
  value = value.replace(/`([^`]+)`/g, '<code class="le-inline-code">$1</code>');
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  value = value.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  value = value.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2" class="le-link">$1</a>');
  return value;
}

export function classifyLine(line: string): ClassifiedLine {
  let match: RegExpMatchArray | null;
  if (/^\s*$/.test(line)) return { type: "empty" };
  if ((match = line.match(/^(#{1,6})\s+(.*)$/))) return { type: "heading", level: match[1].length, text: match[2] };
  if ((match = line.match(/^>\s?(.*)$/))) return { type: "quote", text: match[1] };
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return { type: "hr" };
  if ((match = line.match(/^(\s*)[-*+]\s+\[([ xX])]\s+(.*)$/))) {
    return { type: "checkbox", indent: match[1].length, checked: /x/i.test(match[2]), text: match[3] };
  }
  if ((match = line.match(/^(\s*)[-*+]\s+(.*)$/))) return { type: "ul", indent: match[1].length, text: match[2] };
  if ((match = line.match(/^(\s*)(\d+)\.\s+(.*)$/))) return { type: "ol", indent: match[1].length, num: match[2], text: match[3] };
  if ((match = line.match(/^!\[([^\]]*)]\(([^)]+)\)\s*$/))) return { type: "image", alt: match[1], src: match[2] };
  return { type: "paragraph", text: line };
}

export function groupBlocks(lines: string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      const start = index;
      let end = index + 1;
      while (end < lines.length && !/^\s*```/.test(lines[end])) end += 1;
      blocks.push({ type: "code", startLine: start, endLine: Math.max(end < lines.length ? end : end - 1, start) });
      index = blocks[blocks.length - 1].endLine + 1;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const start = index;
      let end = index;
      while (end < lines.length && /^\s*\|.*\|\s*$/.test(lines[end])) end += 1;
      if (end - 1 > start) {
        blocks.push({ type: "table", startLine: start, endLine: end - 1 });
        index = end;
        continue;
      }
    }
    blocks.push({ type: "line", startLine: index, endLine: index });
    index += 1;
  }
  return blocks;
}

export function parseTable(lines: string[]) {
  const rows = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  return { header: rows[0] ?? [], body: rows.slice(2) };
}

export function codeFenceLang(firstLine: string) {
  return firstLine.match(/^\s*```\s*([\w+-]*)/)?.[1] ?? "";
}

