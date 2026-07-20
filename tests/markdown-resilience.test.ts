import assert from "node:assert/strict";
import test from "node:test";
import { buildMarkdownHeadingTree, extractMarkdownHeadings, parseMarkdownContent } from "../src/lib/markdown";
import { groupBlocks, shouldRenderLinePreview } from "../src/pages/admin/markdownEngine";

const transientDocuments = [
  "",
  "#",
  "## ",
  "---",
  "---\ntitle:",
  "---\ntitle: [\n---\n# 内容",
  "```",
  "```ts\nconst value = 1",
  "| 列 A |",
  "| 列 A | 列 B |\n| --- | --- |",
  "![未完成](",
  "**未闭合",
  "[链接](broken",
  "# 标题\n正文\n## 子标题\n正文",
  "# 重复\n# 重复\n### 跳级",
];

test("all transient markdown states remain parseable while the user is deleting", () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    for (const markdown of transientDocuments) {
      assert.doesNotThrow(() => parseMarkdownContent(markdown));
      assert.doesNotThrow(() => extractMarkdownHeadings(markdown));
      assert.doesNotThrow(() => buildMarkdownHeadingTree(extractMarkdownHeadings(markdown)));
      assert.doesNotThrow(() => groupBlocks(markdown.split("\n")));
    }
  } finally {
    console.warn = originalWarn;
  }
});

test("deleting heading characters updates the title tree incrementally", () => {
  const states = ["## 标题", "## 标", "## ", "##", "#", ""];
  assert.deepEqual(states.map((value) => extractMarkdownHeadings(value).length), [1, 1, 0, 0, 0, 0]);
});

test("duplicate and skipped headings always produce a valid hierarchy", () => {
  const headings = extractMarkdownHeadings("# 重复\n### 子级\n# 重复\n###### 深层");
  assert.deepEqual(headings.map((item) => item.id), ["重复", "子级", "重复-1", "深层"]);
  const tree = buildMarkdownHeadingTree(headings);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[1].children.length, 1);
});

test("code fences and tables remain grouped while surrounding paragraphs change", () => {
  const lines = [
    "开头",
    "```ts",
    "const value = 1;",
    "```",
    "中间",
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "结尾",
  ];
  assert.deepEqual(groupBlocks(lines), [
    { type: "line", startLine: 0, endLine: 0 },
    { type: "code", startLine: 1, endLine: 3 },
    { type: "line", startLine: 4, endLine: 4 },
    { type: "table", startLine: 5, endLine: 7 },
    { type: "line", startLine: 8, endLine: 8 },
  ]);
});

test("an unfinished code fence safely consumes the remaining editor lines", () => {
  assert.deepEqual(groupBlocks(["正文", "```js", "const value = 1"]), [
    { type: "line", startLine: 0, endLine: 0 },
    { type: "code", startLine: 1, endLine: 2 },
  ]);
});

test("standalone visual markdown lines render as previews while idle", () => {
  assert.equal(shouldRenderLinePreview("![架构图](/uploads/architecture.png)"), true);
  assert.equal(shouldRenderLinePreview("---"), true);
  assert.equal(shouldRenderLinePreview("***"), true);
  assert.equal(shouldRenderLinePreview("___"), true);
  assert.equal(shouldRenderLinePreview("正文"), false);
  assert.equal(shouldRenderLinePreview("## 标题"), false);
});
