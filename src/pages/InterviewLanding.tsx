import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookMarked, BookOpen, Braces, Database, FileText, GitBranch, Layers, Search } from "lucide-react";
import { useData } from "../context/DataContext";
import type { DocNode } from "../data";

type CategoryTone = "indigo" | "orange" | "teal";
const categoryIcons = [Braces, Database, GitBranch, Layers] as const;
const categoryColors = ["indigo", "teal", "orange"] as const;

interface InterviewCategory {
  id: string;
  title: string;
  icon: typeof Braces;
  color: CategoryTone;
  children: DocNode[];
  totalFiles: number;
}

const tileStyles: Record<CategoryTone, string> = {
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  orange: "bg-orange-50 text-orange-500 border-orange-100",
  teal: "bg-teal-50 text-teal-600 border-teal-100",
};

function flattenDocs(nodes: DocNode[] = []): DocNode[] {
  return nodes.flatMap((node) => {
    if (!node.isFolder) return [node];
    return flattenDocs(node.children ?? []);
  });
}

function countDocs(nodes: DocNode[] = []): number {
  return nodes.reduce((sum, node) => {
    if (!node.isFolder) return sum + 1;
    return sum + countDocs(node.children ?? []);
  }, 0);
}

function buildCategories(docs: DocNode[]): InterviewCategory[] {
  return docs
    .filter((node) => node.isFolder)
    .map((node, index) => {
      const children = flattenDocs(node.children ?? []);
      return {
        id: node.id,
        title: node.title,
        icon: categoryIcons[index % categoryIcons.length],
        color: categoryColors[index % categoryColors.length],
        children,
        totalFiles: countDocs(node.children ?? []),
      };
    })
    .filter((category) => category.totalFiles > 0);
}

export function InterviewLanding() {
  const { docs, loading } = useData();
  const [active, setActive] = useState("全部");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => buildCategories(docs), [docs]);
  const totalDocs = categories.reduce((sum, category) => sum + category.totalFiles, 0);
  const filteredCategories = categories
    .filter((category) => active === "全部" || category.title === active)
    .map((category) => {
      const term = query.trim().toLowerCase();
      if (!term) return category;
      return {
        ...category,
        children: category.children.filter((doc) => `${category.title} ${doc.title}`.toLowerCase().includes(term)),
      };
    })
    .filter((category) => category.children.length > 0 || !query.trim());
  const firstDocId = categories[0]?.children[0]?.id;

  return (
    <div className="jx-screen flex min-h-[calc(100vh-80px)] flex-col pt-20 md:flex-row">
      <aside className="shrink-0 border-b border-gray-100 bg-white/65 px-6 py-8 backdrop-blur md:sticky md:top-20 md:h-[calc(100vh-80px)] md:w-72 md:overflow-y-auto md:border-b-0 md:border-r md:px-7 md:py-10">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 shadow-sm transition-colors hover:border-teal-200 hover:text-teal-600">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </Link>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-600">
          <BookOpen className="h-4 w-4" />
          Interview Notes · 面经
        </div>

        <div className="mb-7 space-y-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          {[
            ["文章总数", `${totalDocs} 题`],
            ["分类数", `${categories.length} 个`],
            ["覆盖方向", categories.map((category) => category.title).join(" · ") || "-"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-gray-400">{label}</span>
              <span className="font-mono text-[13px] font-bold text-gray-900">{value}</span>
            </div>
          ))}
        </div>

        <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">知识分类</div>
        <div className="mb-7 flex flex-col gap-1">
          <button onClick={() => setActive("全部")} className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${active === "全部" ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <span className={`text-[13px] ${active === "全部" ? "font-bold" : "font-medium"}`}>全部</span>
            <span className={`font-mono text-[11px] font-bold ${active === "全部" ? "text-teal-600" : "text-gray-400"}`}>{totalDocs}</span>
          </button>
          {categories.map((category) => {
            const Icon = category.icon;
            const selected = active === category.title;
            return (
              <button
                key={category.id}
                onClick={() => setActive(category.title)}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${selected ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <Icon className={`h-3.5 w-3.5 ${selected ? "text-teal-600" : "text-gray-400"}`} />
                <span className={`min-w-0 flex-1 truncate text-[13px] ${selected ? "font-bold" : "font-medium"}`}>{category.title}</span>
                <span className={`font-mono text-[11px] font-bold ${selected ? "text-teal-600" : "text-gray-400"}`}>{category.totalFiles}</span>
              </button>
            );
          })}
        </div>

        <label className="mb-3 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400" htmlFor="interview-search">搜索</label>
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2.5">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            id="interview-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索题目关键词..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
          />
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-6 py-8 md:px-11 md:py-10 xl:px-16 2xl:px-20">
        <div className="relative mb-9 overflow-hidden rounded-[2rem] border border-gray-100 bg-[#faf7f1] px-7 py-9 md:px-11 md:py-10">
          <BookMarked className="absolute -right-5 -top-10 h-40 w-40 text-[#c8473a] opacity-[0.08]" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[3px] bg-[linear-gradient(150deg,#ce4b39,#b33326)] font-cn-serif text-xs font-bold text-white">经</span>
              <span className="font-cn-serif text-sm text-[#c8473a]">这是我的面经汇总</span>
            </div>
            <h1 className="mb-3 font-cn-brush text-[34px] font-normal leading-tight tracking-normal text-[#211c18]">面经手记</h1>
            <p className="mb-7 max-w-lg text-[15px] font-medium leading-7 text-gray-700 md:max-w-none">汇总了准备面试路上整理的核心知识点以及个人理解，从 Java 基础到并发、数据库、JVM等。</p>
            <Link to={firstDocId ? `/interview/read?id=${firstDocId}` : "/interview/read"} className="inline-flex h-12 items-center gap-2 rounded-full bg-gray-900 px-7 text-[15px] font-bold text-white shadow-lg shadow-gray-900/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-600 active:scale-95">
              点击阅读
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-900">{active === "全部" ? "全部分类" : active}</h2>
          <span className="font-mono text-xs font-bold text-gray-400">{filteredCategories.length} 个分类</span>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">正在读取面经内容...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">没有匹配的题目。</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const targetId = category.children[0]?.id;
              const visibleDocs = category.children.slice(0, 6);
              const hiddenDocCount = category.children.length - visibleDocs.length;
              return (
                <Link key={category.id} to={targetId ? `/interview/read?id=${targetId}` : "/interview/read"} className="group rounded-[2rem] border border-gray-100 bg-white px-6 py-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)]">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${tileStyles[category.color]}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 font-mono text-[11px] font-bold text-gray-400">{category.totalFiles} 题</span>
                  </div>
                  <h3 className="mb-3 font-display text-lg font-bold text-gray-900 transition-colors group-hover:text-indigo-600">{category.title}</h3>
                  <div className="mb-5 flex flex-col gap-2">
                    {visibleDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate text-[13px] font-medium text-gray-700">{doc.title}</span>
                      </div>
                    ))}
                    {hiddenDocCount > 0 && (
                      <div className="pl-5 font-mono text-[11px] font-bold text-gray-400">还有 {hiddenDocCount} 篇</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-xs font-semibold text-gray-400">点击进入</span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-400 transition-colors group-hover:text-indigo-600">
                      开始阅读
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
