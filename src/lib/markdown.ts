import YAML from "yaml";

export interface ParsedMarkdown {
  content: string;
  frontmatter: Record<string, unknown>;
}

export interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
  line: number;
}

const CJK_CHAR_CLASS = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}";

function normalizeInlineMarkdown(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(new RegExp(`([${CJK_CHAR_CLASS}])\\*\\*([^*\\n|]+?)\\*\\*`, "gu"), "$1<strong>$2</strong>")
    .replace(new RegExp(`\\*\\*([^*\\n|]+?)\\*\\*([${CJK_CHAR_CLASS}])`, "gu"), "<strong>$1</strong>$2");
}

function normalizeLatexDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `\n\n$$\n${expression.trim()}\n$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression: string) => `$${expression.trim()}$`);
}

function normalizeMarkdownContent(content: string): string {
  return content
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((block) => {
      if (block.startsWith("```") || block.startsWith("~~~")) return block;

      return block
        .split(/(`[^`\n]*`)/g)
        .map((part) => (part.startsWith("`") ? part : normalizeLatexDelimiters(normalizeInlineMarkdown(part))))
        .join("");
    })
    .join("")
    .replace(
      new RegExp(
        `(^|\\n)([ \\t]*(?![-*+]\\s+|\\d+\\.\\s+)[^\\n]*[${CJK_CHAR_CLASS}，。；：！？）】》」』])\\n([ \\t]*(?:[-*+]\\s+|\\d+\\.\\s+))`,
        "gu",
      ),
      "$1$2\n\n$3",
    );
}

export function parseMarkdownContent(markdown: string): ParsedMarkdown {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  if (!match) {
    return {
      content: normalizeMarkdownContent(markdown.trim()),
      frontmatter: {},
    };
  }

  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed = YAML.parse(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("Failed to parse markdown frontmatter", error);
  }

  return {
    content: normalizeMarkdownContent(markdown.slice(match[0].length).trim()),
    frontmatter,
  };
}

export function slugifyMarkdownHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function createMarkdownSlugger() {
  const seen = new Map<string, number>();

  return (text: string) => {
    const base = slugifyMarkdownHeading(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);

    return count === 0 ? base : `${base}-${count}`;
  };
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\s+#+\s*$/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function extractMarkdownHeadings(markdown: string, levels: number[] = [1, 2, 3, 4, 5, 6]): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const getSlug = createMarkdownSlugger();
  const lines = parseMarkdownContent(markdown).content.split(/\r?\n/);
  let fence: { marker: "`" | "~"; length: number } | null = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      const length = fenceMatch[1].length;

      if (!fence) {
        fence = { marker, length };
      } else if (fence.marker === marker && length >= fence.length) {
        fence = null;
      }

      return;
    }

    if (fence) return;

    const headingMatch = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if (!headingMatch) return;

    const level = headingMatch[1].length;
    if (!levels.includes(level)) return;

    const text = stripInlineMarkdown(headingMatch[2]);
    if (!text) return;

    headings.push({
      id: getSlug(text),
      text,
      level,
      line: index + 1,
    });
  });

  return headings;
}
