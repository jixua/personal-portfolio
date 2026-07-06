import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Braces, ChevronRight, Database, FileText, Layers, Search, Workflow } from "lucide-react";
import { useData } from "../context/DataContext";
import type { DocNode } from "../data";

const chapterNums = ["壹", "贰", "叁", "肆", "伍", "陆"];
const categoryIcons = [Braces, Database, Workflow, Layers] as const;
const docPreviewLineBudget = 520;

interface InterviewCategory {
  id: string;
  title: string;
  children: DocNode[];
}

function flattenDocs(nodes: DocNode[] = []): DocNode[] {
  return nodes.flatMap((node) => (node.isFolder ? flattenDocs(node.children ?? []) : [node]));
}

function buildCategories(docs: DocNode[]): InterviewCategory[] {
  return docs
    .filter((node) => node.isFolder)
    .map((node) => ({
      id: node.id,
      title: node.title,
      children: flattenDocs(node.children ?? []),
    }))
    .filter((category) => category.children.length > 0);
}

function estimateChipWidth(title: string) {
  const textWidth = Array.from(title).reduce((sum, char) => sum + (/[\u4e00-\u9fff]/.test(char) ? 13 : 7), 0);
  return Math.min(220, Math.max(76, textWidth + 48));
}

function getSingleLineDocPreview(docs: DocNode[]) {
  const visibleDocs: DocNode[] = [];
  let usedWidth = 0;

  for (const [index, doc] of docs.entries()) {
    const remainingAfterThis = docs.length - index - 1;
    const overflowLabelWidth = remainingAfterThis > 0 ? 44 : 0;
    const nextWidth = estimateChipWidth(doc.title);
    const gapWidth = visibleDocs.length > 0 ? 8 : 0;

    if (usedWidth + gapWidth + nextWidth + overflowLabelWidth <= docPreviewLineBudget) {
      visibleDocs.push(doc);
      usedWidth += gapWidth + nextWidth;
      continue;
    }

    if (visibleDocs.length === 0) visibleDocs.push(doc);
    break;
  }

  return {
    visibleDocs,
    hiddenDocCount: docs.length - visibleDocs.length,
  };
}

export function InterviewLanding() {
  const { docs, loading } = useData();
  const [active, setActive] = useState("全部");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => buildCategories(docs), [docs]);
  const totalDocs = categories.reduce((sum, category) => sum + category.children.length, 0);
  const term = query.trim().toLowerCase();
  const filteredCategories = categories
    .filter((category) => active === "全部" || category.title === active)
    .map((category) => ({
      ...category,
      children: term ? category.children.filter((doc) => `${category.title} ${doc.title}`.toLowerCase().includes(term)) : category.children,
    }))
    .filter((category) => category.children.length > 0 || !term);
  const firstDocId = categories[0]?.children[0]?.id;

  return (
    <div className="jx-screen flex min-h-[calc(100vh-80px)] flex-col pt-20 md:flex-row">
      <aside className="shrink-0 border-b border-gray-100 bg-white/65 px-6 py-8 md:sticky md:top-20 md:h-[calc(100vh-80px)] md:w-72 md:overflow-y-auto md:border-b-0 md:border-r md:px-7 md:py-10">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 transition-colors duration-200 ease-in-out hover:border-teal-200 hover:text-teal-600">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </Link>

        <div className="mb-7 inline-flex whitespace-nowrap rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 font-mono text-[11px] font-bold text-teal-600">
          <span className="inline-flex items-center gap-[7px]">
            <BookOpen className="h-[13px] w-[13px] shrink-0" />
            Interview Notes · 面经
          </span>
        </div>

        <div className="mb-7">
          <label className="mb-2.5 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400" htmlFor="interview-search">
            搜索
          </label>
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2.5">
            <Search className="h-[15px] w-[15px] text-gray-400" />
            <input
              id="interview-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索题目关键词..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">知识分类</div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setActive("全部")}
            className={`flex items-center justify-between rounded-[10px] px-2.5 py-[9px] text-left transition-colors duration-200 ease-in-out ${
              active === "全部" ? "bg-teal-50" : "hover:bg-gray-50"
            }`}
          >
            <span className={`text-[13px] ${active === "全部" ? "font-bold text-teal-700" : "font-medium text-gray-600"}`}>全部</span>
            <span className={`font-mono text-[11px] font-bold ${active === "全部" ? "text-teal-600" : "text-gray-400"}`}>{totalDocs}</span>
          </button>
          {categories.map((category) => {
            const selected = active === category.title;
            return (
              <button
                key={category.id}
                onClick={() => setActive(category.title)}
                className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-[9px] text-left transition-colors duration-200 ease-in-out ${
                  selected ? "bg-teal-50" : "hover:bg-gray-50"
                }`}
              >
                <span className={`min-w-0 truncate text-[13px] ${selected ? "font-bold text-teal-700" : "font-medium text-gray-600"}`}>{category.title}</span>
                <span className={`shrink-0 font-mono text-[11px] font-bold ${selected ? "text-teal-600" : "text-gray-400"}`}>{category.children.length}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-6 py-10 md:px-11 md:py-14 xl:px-16">
        <div className="mx-auto max-w-[760px]">
          <div className="relative mb-12 overflow-hidden rounded-[32px] border border-gray-100 bg-[#faf7f1] px-7 py-9 md:px-12 md:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--seal)_1px,transparent_0)] bg-[length:26px_26px] opacity-[0.05]" />
            <div className="relative">
              <div className="mb-[18px] flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[3px] bg-[linear-gradient(150deg,#ce4b39,#b33326)] font-cn-serif text-[13px] font-bold text-white">经</span>
                <span className="font-cn-serif text-sm text-[#c8473a]">这是我的面经汇总</span>
              </div>
              <h1 className="mb-3.5 font-cn-brush text-4xl font-normal leading-tight tracking-normal text-[#211c18]">面经手记</h1>
              <p className="mb-7 max-w-[480px] text-[15px] font-medium leading-[1.75] text-gray-700">汇总了准备面试路上整理的核心知识点以及个人理解，从 Java 基础到并发、数据库、JVM 等。</p>
              <Link to={firstDocId ? `/interview/read?id=${firstDocId}` : "/interview/read"} className="inline-flex h-12 items-center gap-2 rounded-full bg-gray-900 px-7 text-[15px] font-bold text-white transition-colors duration-200 ease-in-out hover:bg-teal-700">
                点击阅读
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm font-medium text-gray-500">正在读取面经内容...</div>
          ) : filteredCategories.length === 0 ? (
            <div className="border-t border-gray-100 py-12 text-center text-sm font-medium text-gray-500">没有匹配的题目。</div>
          ) : (
            <div>
              {filteredCategories.map((category, index) => {
                const Icon = categoryIcons[index % categoryIcons.length];
                const { visibleDocs, hiddenDocCount } = getSingleLineDocPreview(category.children);
                const targetId = category.children[0]?.id;

                return (
                  <Link
                    key={category.id}
                    to={targetId ? `/interview/read?id=${targetId}` : "/interview/read"}
                    className={`group flex cursor-pointer gap-6 py-7 ${index === filteredCategories.length - 1 ? "" : "border-b border-gray-100"}`}
                  >
                    <div className="w-10 shrink-0 font-cn-serif text-[26px] font-bold text-[#fbdfda]">{chapterNums[index % chapterNums.length]}</div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-teal-100 bg-teal-50 text-teal-600">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <h3 className="m-0 font-display text-[19px] font-bold text-gray-900 transition-colors duration-200 ease-in-out group-hover:text-[#c8473a]">{category.title}</h3>
                        <span className="font-mono text-[11px] font-bold text-gray-400">{category.children.length} 题</span>
                      </div>
                      <div className="flex max-w-full flex-nowrap gap-2 overflow-hidden">
                        {visibleDocs.map((doc) => (
                          <span key={doc.id} className="inline-flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[13px] text-gray-600">
                            <FileText className="h-3 w-3 shrink-0 text-gray-400" />
                            <span className="min-w-0 truncate">{doc.title}</span>
                          </span>
                        ))}
                        {hiddenDocCount > 0 && <span className="inline-flex shrink-0 items-center px-1 py-1.5 font-mono text-[11px] font-bold text-gray-400">+{hiddenDocCount}</span>}
                      </div>
                    </div>
                    <ChevronRight className="mt-3 h-[18px] w-[18px] shrink-0 self-center text-gray-300 transition-all duration-200 ease-in-out group-hover:translate-x-0.5 group-hover:text-[#c8473a]" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
