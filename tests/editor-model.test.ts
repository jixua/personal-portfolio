import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteEditableSelection,
  editableLineParts,
  replaceEditableSelection,
  splitEditableLine,
} from "../src/pages/admin/editorModel";

test("recognizes every editable markdown line type without losing its prefix", () => {
  const cases = [
    ["# 标题", "# ", "标题"],
    ["###### 六级", "###### ", "六级"],
    ["> 引用", "> ", "引用"],
    ["  - 列表", "  - ", "列表"],
    ["12. 有序", "12. ", "有序"],
    ["  - [x] 完成", "  - [x] ", "完成"],
    ["普通段落", "", "普通段落"],
    ["", "", ""],
  ] as const;
  for (const [raw, prefix, text] of cases) {
    const parts = editableLineParts(raw);
    assert.equal(parts.prefix, prefix);
    assert.equal(parts.text, text);
    assert.equal(parts.toRaw(text), raw);
  }
});

test("deletes selected title text while preserving heading structure", () => {
  const result = deleteEditableSelection(["## 标题内容"], 0, 0, 2, "backward");
  assert.deepEqual(result, { lines: ["## 内容"], focusLine: 0, caret: 0 });
});

test("deletes a fully selected level-one heading without removing the editor line", () => {
  const result = deleteEditableSelection(["# 一级标题"], 0, 0, 4, "forward");
  assert.deepEqual(result, { lines: ["# "], focusLine: 0, caret: 0 });
});

test("deletes a selected paragraph without removing the editor line", () => {
  const result = deleteEditableSelection(["一段普通内容"], 0, 0, 6, "forward");
  assert.deepEqual(result, { lines: [""], focusLine: 0, caret: 0 });
});

test("backspace deletes one Chinese character", () => {
  assert.deepEqual(deleteEditableSelection(["中文段落"], 0, 2, 2, "backward").lines, ["中段落"]);
});

test("delete removes one Chinese character after the caret", () => {
  assert.deepEqual(deleteEditableSelection(["中文段落"], 0, 2, 2, "forward").lines, ["中文落"]);
});

test("backspace and delete remove an emoji as one character", () => {
  assert.deepEqual(deleteEditableSelection(["A😀B"], 0, 3, 3, "backward").lines, ["AB"]);
  assert.deepEqual(deleteEditableSelection(["A😀B"], 0, 1, 1, "forward").lines, ["AB"]);
});

test("backspace at a heading start removes heading formatting first", () => {
  const result = deleteEditableSelection(["上一段", "### 标题"], 1, 0, 0, "backward");
  assert.deepEqual(result, { lines: ["上一段", "标题"], focusLine: 1, caret: 0 });
});

test("backspace at list and quote starts removes their formatting first", () => {
  assert.deepEqual(deleteEditableSelection(["- 项目"], 0, 0, 0, "backward").lines, ["项目"]);
  assert.deepEqual(deleteEditableSelection(["> 引用"], 0, 0, 0, "backward").lines, ["引用"]);
  assert.deepEqual(deleteEditableSelection(["- [ ] 待办"], 0, 0, 0, "backward").lines, ["待办"]);
});

test("backspace at a paragraph start joins the previous paragraph", () => {
  const result = deleteEditableSelection(["第一段", "第二段"], 1, 0, 0, "backward");
  assert.deepEqual(result, { lines: ["第一段第二段"], focusLine: 0, caret: 3 });
});

test("backspace joins a paragraph into a previous heading without duplicating markers", () => {
  const result = deleteEditableSelection(["## 标题", "正文"], 1, 0, 0, "backward");
  assert.deepEqual(result, { lines: ["## 标题正文"], focusLine: 0, caret: 2 });
});

test("delete at a line end joins the following paragraph", () => {
  const result = deleteEditableSelection(["第一段", "第二段"], 0, 3, 3, "forward");
  assert.deepEqual(result, { lines: ["第一段第二段"], focusLine: 0, caret: 3 });
});

test("delete at a heading end joins the next line and preserves current heading", () => {
  assert.deepEqual(deleteEditableSelection(["## 标题", "正文"], 0, 2, 2, "forward").lines, ["## 标题正文"]);
});

test("delete at document boundaries is a stable no-op", () => {
  assert.deepEqual(deleteEditableSelection(["内容"], 0, 0, 0, "backward").lines, ["内容"]);
  assert.deepEqual(deleteEditableSelection(["内容"], 0, 2, 2, "forward").lines, ["内容"]);
  assert.deepEqual(deleteEditableSelection([""], 0, 0, 0, "backward").lines, [""]);
});

test("cross-line selection deletion preserves the first line format only", () => {
  const result = replaceEditableSelection(
    ["## 标题内容", "中间段落", "- 列表结尾"],
    { startLine: 0, startOffset: 2, endLine: 2, endOffset: 2 },
  );
  assert.deepEqual(result, { lines: ["## 标题结尾"], focusLine: 0, caret: 2 });
});

test("cross-line replacement supports multiline pasted text", () => {
  const result = replaceEditableSelection(
    ["> 开始内容", "被替换", "结束内容"],
    { startLine: 0, startOffset: 2, endLine: 2, endOffset: 2 },
    "新一行\n新二行",
  );
  assert.deepEqual(result, { lines: ["> 开始新一行", "新二行内容"], focusLine: 1, caret: 3 });
});

test("single-line replacement works for inline markdown text", () => {
  const result = replaceEditableSelection(
    ["含有 **粗体** 和 `代码`"],
    { startLine: 0, startOffset: 3, endLine: 0, endOffset: 9 },
    "替换",
  );
  assert.deepEqual(result.lines, ["含有 替换 和 `代码`"]);
});

test("Enter splits a paragraph and removes the selected range", () => {
  const result = splitEditableLine(["前半删除后半"], 0, 2, 4);
  assert.deepEqual(result, { lines: ["前半", "后半"], focusLine: 1, caret: 0 });
});

test("Enter preserves heading formatting on the first line only", () => {
  const result = splitEditableLine(["## 标题正文"], 0, 2, 2);
  assert.deepEqual(result, { lines: ["## 标题", "正文"], focusLine: 1, caret: 0 });
});

test("multiline paste preserves the current list prefix on its first line", () => {
  const result = replaceEditableSelection(
    ["- 项目结尾"],
    { startLine: 0, startOffset: 2, endLine: 0, endOffset: 2 },
    "甲\n乙",
  );
  assert.deepEqual(result, { lines: ["- 项目甲", "乙结尾"], focusLine: 1, caret: 1 });
});

test("out-of-range line and offset inputs are clamped safely", () => {
  assert.deepEqual(deleteEditableSelection(["内容"], 99, -10, 99, "forward").lines, [""]);
  assert.deepEqual(replaceEditableSelection([], { startLine: 0, startOffset: 0, endLine: 0, endOffset: 0 }, "新建").lines, ["新建"]);
});
