import assert from "node:assert/strict";
import test from "node:test";
import { getMarkdownTitleFromFileName } from "../src/pages/admin/fileHelpers";

test("uses a markdown file name as the imported title", () => {
  assert.equal(getMarkdownTitleFromFileName("Java 并发面经.md"), "Java 并发面经");
  assert.equal(getMarkdownTitleFromFileName("MySQL.notes.markdown"), "MySQL.notes");
  assert.equal(getMarkdownTitleFromFileName("Redis.MD"), "Redis");
});
