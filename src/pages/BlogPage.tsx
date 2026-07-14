import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, FileText, Folder, ListTree } from "lucide-react";
import { DocNode } from "../data";
import { useData } from "../context/DataContext";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { buildMarkdownHeadingTree, extractMarkdownHeadings, flattenVisibleMarkdownHeadingTree, getMarkdownHeadingKey } from "../lib/markdown";

type ContentTab = "blog" | "docs";

type NavItem = {
  id: string;
  title: string;
};

function findFirstDoc(nodes: DocNode[]): DocNode | undefined {
  for (const node of nodes) {
    if (!node.isFolder) return node;
    if (node.children) {
      const found = findFirstDoc(node.children);
      if (found) return found;
    }
  }
}

function findDoc(nodes: DocNode[], id: string): DocNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findDoc(node.children, id);
      if (found) return found;
    }
  }
}

function findDocPath(nodes: DocNode[], id: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node.id];
    if (node.id === id) return nextPath;
    if (node.children) {
      const found = findDocPath(node.children, id, nextPath);
      if (found) return found;
    }
  }
  return null;
}

function flattenDocs(nodes: DocNode[] = []): DocNode[] {
  return nodes.flatMap((node) => (node.isFolder ? flattenDocs(node.children ?? []) : [node]));
}

export function BlogPage({
  mode,
  backPath = "/",
  backLabel = "返回主页",
}: {
  mode: ContentTab;
  backPath?: string;
  backLabel?: string;
}) {
  const { posts: blogPosts, docs: knowledgeDocs, loading } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const idFromUrl = searchParams.get("id");

  const [activeId, setActiveId] = useState<string | null>(idFromUrl || null);
  const [activeTab, setActiveTab] = useState<ContentTab>(mode);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["kb-1", "kb-1-1", "kb-1-2", "kb-1-2-1", "kb-1-3", "kb-1-3-1"]));
  const activeContentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeId) {
      setSearchParams({ id: activeId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [activeId, setSearchParams]);

  useEffect(() => {
    setActiveTab(mode);
    setActiveId(idFromUrl || null);
    activeContentKeyRef.current = null;
  }, [mode, idFromUrl]);

  useEffect(() => {
    if (activeTab === "docs") {
      const exists = activeId ? findDoc(knowledgeDocs, activeId) : undefined;
      if (!exists) {
        const first = findFirstDoc(knowledgeDocs);
        setActiveId(first?.id ?? null);
      }
    } else {
      const exists = activeId ? blogPosts.find((post) => post.id === activeId) : undefined;
      if (!exists && blogPosts.length > 0) setActiveId(blogPosts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeTab, knowledgeDocs, blogPosts]);

  useEffect(() => {
    if (activeTab !== "docs" || !activeId) return;
    const path = findDocPath(knowledgeDocs, activeId);
    if (!path || path.length <= 1) return;
    setExpandedFolders((current) => {
      const next = new Set(current);
      path.slice(0, -1).forEach((id) => next.add(id));
      return next;
    });
  }, [activeId, activeTab, knowledgeDocs]);

  const activePost = blogPosts.find((post) => post.id === activeId);
  const activeDoc = activeTab === "docs" && activeId ? findDoc(knowledgeDocs, activeId) : null;
  const activeContent =
    activeTab === "docs" && activeDoc
      ? activeDoc.content || `> ${activeDoc.title} 的内容正在维护中...`
      : activeTab === "blog" && activePost
        ? activePost.content || `${activePost.snippet}\n\n*完整内容敬请期待...*`
        : "";

  const outlineHeadings = useMemo(() => extractMarkdownHeadings(activeContent), [activeContent]);
  const flatItems: NavItem[] = useMemo(
    () => (activeTab === "docs" ? flattenDocs(knowledgeDocs).map((doc) => ({ id: doc.id, title: doc.title })) : blogPosts.map((post) => ({ id: post.id, title: post.title }))),
    [activeTab, blogPosts, knowledgeDocs],
  );
  const activeIndex = flatItems.findIndex((item) => item.id === activeId);
  const prevItem = activeIndex > 0 ? flatItems[activeIndex - 1] : null;
  const nextItem = activeIndex >= 0 && activeIndex < flatItems.length - 1 ? flatItems[activeIndex + 1] : null;

  useEffect(() => {
    if (!activeId) return;
    const nextKey = `${activeTab}:${activeId}`;
    if (activeContentKeyRef.current === nextKey) return;
    activeContentKeyRef.current = nextKey;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeId, activeTab]);

  const openItem = (id: string, tab: ContentTab = activeTab) => {
    setActiveTab(tab);
    setActiveId(id);
  };

  const toggleFolder = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedFolders(next);
  };

  const renderTree = (nodes: DocNode[], level = 0) => (
    <ul className={level === 0 ? "space-y-2" : "mt-1 space-y-1 border-l border-gray-100"}>
      {nodes.map((node) => {
        const isExpanded = expandedFolders.has(node.id);
        const isActive = activeId === node.id && activeTab === "docs";
        const indent = level === 0 ? 0 : level * 14;

        if (node.isFolder) {
          return (
            <li key={node.id} className="select-none">
              <div
                onClick={(event) => toggleFolder(node.id, event)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-gray-800 transition-colors duration-200 ease-in-out hover:bg-gray-50"
                style={{ marginLeft: indent }}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                <Folder className="h-3.5 w-3.5 text-teal-600" />
                <span className="min-w-0 truncate">{node.title}</span>
              </div>
              <AnimatePresence>
                {isExpanded && node.children && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {renderTree(node.children, level + 1)}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        }

        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => openItem(node.id, "docs")}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200 ease-in-out ${
                isActive ? "bg-teal-50 font-bold text-teal-700" : "text-gray-500 hover:bg-gray-50"
              }`}
              style={{ marginLeft: indent + 18 }}
            >
              <FileText className={`h-3 w-3 shrink-0 ${isActive ? "text-teal-600" : "text-gray-400"}`} />
              <span className="min-w-0 truncate">{node.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const accent = activeTab === "docs" ? "teal" : "indigo";
  const eyebrow = activeTab === "docs" ? "Interview Notes · 面经" : "Knowledge Base · 博客";

  return (
    <div className="flex min-h-screen flex-col bg-white pt-20 md:flex-row">
      <aside className="shrink-0 border-b border-gray-100 bg-white/80 px-4 py-5 backdrop-blur md:fixed md:left-0 md:top-20 md:h-[calc(100vh-80px)] md:w-[280px] md:overflow-y-auto md:border-b-0 md:border-r md:py-6">
        <Link to={backPath} className={`mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-gray-500 transition-colors duration-200 ease-in-out ${accent === "teal" ? "hover:text-teal-600" : "hover:text-indigo-600"}`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        {activeTab === "docs" ? (
          <nav>{renderTree(knowledgeDocs)}</nav>
        ) : (
          <nav className="flex flex-col gap-1">
            {blogPosts.map((post) => {
              const isActive = activeId === post.id;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => openItem(post.id, "blog")}
                  className={`rounded-xl border p-3 text-left transition-colors duration-200 ease-in-out ${
                    isActive ? "border-indigo-100 bg-indigo-50" : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <span className={`mb-1.5 block font-display text-sm font-bold leading-snug ${isActive ? "text-indigo-900" : "text-gray-800"}`}>{post.title}</span>
                  <span className="block font-mono text-xs text-gray-400">{post.date}</span>
                </button>
              );
            })}
          </nav>
        )}
      </aside>

      <main className="min-w-0 flex-1 md:ml-[280px] xl:mr-[280px]">
        <div className="mx-auto w-full max-w-[880px] px-6 py-12 md:px-11 md:py-14">
          {loading ? (
            <div className="flex h-[50vh] items-center justify-center text-sm font-medium text-gray-500">正在读取…</div>
          ) : activeTab === "docs" && activeDoc ? (
            <ReaderArticle
              key={activeDoc.id}
              accent={accent}
              eyebrow={eyebrow}
              title={activeDoc.title}
              content={activeContent}
              prevItem={prevItem}
              nextItem={nextItem}
              onNavigate={openItem}
            />
          ) : activeTab === "blog" && activePost ? (
            <ReaderArticle
              key={activePost.id}
              accent={accent}
              eyebrow={eyebrow}
              title={activePost.title}
              date={activePost.date}
              readTime={activePost.readTime}
              content={activeContent}
              prevItem={prevItem}
              nextItem={nextItem}
              onNavigate={openItem}
            />
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center text-gray-400">
              <FileText className="mb-4 h-16 w-16 text-gray-200" />
              <p>请在左侧选择要阅读的内容</p>
            </div>
          )}
        </div>
        <PublicHeadingToc key={`${activeTab}:${activeId ?? "empty"}`} headings={outlineHeadings} accent={accent} />
      </main>
    </div>
  );
}

function ReaderArticle({
  accent,
  eyebrow,
  title,
  date,
  readTime,
  content,
  prevItem,
  nextItem,
  onNavigate,
}: {
  accent: "indigo" | "teal";
  eyebrow: string;
  title: string;
  date?: string;
  readTime?: string;
  content: string;
  prevItem: NavItem | null;
  nextItem: NavItem | null;
  onNavigate: (id: string) => void;
}) {
  const accentClasses =
    accent === "teal"
      ? {
          eyebrow: "text-teal-600",
          hover: "hover:border-teal-100 hover:text-teal-700",
        }
      : {
          eyebrow: "text-indigo-500",
          hover: "hover:border-indigo-100 hover:text-indigo-700",
        };

  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className={`mb-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${accentClasses.eyebrow}`}>{eyebrow}</div>
      <h1 className={`mb-4 font-display font-black leading-[1.2] text-gray-900 ${date ? "text-[34px]" : "text-[32px]"}`}>{title}</h1>
      {date && readTime && (
        <div className="mb-6 flex items-center gap-3 font-mono text-[13px] font-semibold text-gray-500">
          <span>{date}</span>
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          <span>{readTime}</span>
        </div>
      )}

      <div className="border-t border-gray-100 pt-6">
        <MarkdownRenderer className={`reader-markdown reading-markdown ${accent === "teal" ? "reader-markdown-teal" : ""}`} content={content} />
      </div>

      {(prevItem || nextItem) && (
        <div className="mt-12 grid gap-4 border-t border-gray-100 pt-8 sm:grid-cols-2">
          {prevItem ? (
            <button type="button" onClick={() => onNavigate(prevItem.id)} className={`rounded-2xl border border-gray-100 px-[18px] py-4 text-left transition-colors duration-200 ease-in-out ${accentClasses.hover}`}>
              <span className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-400">
                <ArrowLeft className="h-3 w-3" />
                上一篇
              </span>
              <span className="block font-display text-sm font-bold text-gray-900">{prevItem.title}</span>
            </button>
          ) : (
            <div />
          )}

          {nextItem ? (
            <button type="button" onClick={() => onNavigate(nextItem.id)} className={`rounded-2xl border border-gray-100 px-[18px] py-4 text-right transition-colors duration-200 ease-in-out ${accentClasses.hover}`}>
              <span className="mb-2 flex items-center justify-end gap-1.5 font-mono text-[11px] font-bold text-gray-400">
                下一篇
                <ArrowRight className="h-3 w-3" />
              </span>
              <span className="block font-display text-sm font-bold text-gray-900">{nextItem.title}</span>
            </button>
          ) : (
            <div />
          )}
        </div>
      )}
    </motion.article>
  );
}

function PublicHeadingToc({
  headings,
  accent,
}: {
  headings: ReturnType<typeof extractMarkdownHeadings>;
  accent: "indigo" | "teal";
}) {
  const accentClass = accent === "teal" ? "hover:bg-teal-50 hover:text-teal-700" : "hover:bg-indigo-50 hover:text-indigo-700";
  const tree = useMemo(() => buildMarkdownHeadingTree(headings), [headings]);
  const collapsibleKeys = useMemo(() => {
    const keys: string[] = [];
    const visit = (nodes: typeof tree) => nodes.forEach((node) => {
      if (node.children.length > 0) keys.push(getMarkdownHeadingKey(node));
      visit(node.children);
    });
    visit(tree);
    return keys;
  }, [tree]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const visibleHeadings = useMemo(() => flattenVisibleMarkdownHeadingTree(tree, collapsed), [collapsed, tree]);
  const allCollapsed = collapsibleKeys.length > 0 && collapsibleKeys.every((key) => collapsed.has(key));
  const toggleHeading = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <aside className="fixed right-0 top-20 hidden h-[calc(100vh-80px)] w-[280px] overflow-y-auto border-l border-gray-100 bg-white/90 px-5 py-6 backdrop-blur xl:block">
      <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2 text-gray-700">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent === "teal" ? "bg-teal-50 text-teal-600" : "bg-indigo-50 text-indigo-600"}`}>
            <ListTree className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-sm font-bold">文章目录</span>
        </div>
        <div className="flex items-center gap-1.5">
          {collapsibleKeys.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(collapsibleKeys))}
              className="rounded-md px-1.5 py-1 text-[10px] font-semibold text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
              title={allCollapsed ? "展开全部标题" : "收起全部标题"}
            >
              {allCollapsed ? "展开" : "收起"}
            </button>
          )}
          <span className="rounded-full bg-gray-50 px-2 py-1 font-mono text-[10px] font-bold text-gray-400">{headings.length}</span>
        </div>
      </div>
      {headings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs leading-6 text-gray-400">正文暂无可用标题</div>
      ) : (
        <nav className="space-y-0.5" aria-label="文章目录">
          {visibleHeadings.map((heading) => {
            const key = getMarkdownHeadingKey(heading);
            const hasChildren = heading.children.length > 0;
            const isCollapsed = collapsed.has(key);
            return (
            <div
              key={key}
              className="group relative flex items-start rounded-lg pr-2 text-[13px] leading-5 text-gray-500 transition-colors duration-200 ease-in-out hover:bg-gray-50"
              style={{ paddingLeft: `${heading.depth * 14 + 4}px` }}
            >
              {heading.depth > 0 && (
                <span aria-hidden="true" className="absolute bottom-0 top-0 w-px bg-gray-100" style={{ left: `${heading.depth * 14 - 1}px` }} />
              )}
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleHeading(key)}
                  className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${accent === "teal" ? "hover:bg-teal-100 hover:text-teal-700" : "hover:bg-indigo-100 hover:text-indigo-700"}`}
                  aria-label={isCollapsed ? `展开 ${heading.text}` : `收起 ${heading.text}`}
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span aria-hidden="true" className={`mx-[7px] mt-[15px] h-1.5 w-1.5 shrink-0 rounded-full ${accent === "teal" ? "bg-teal-400" : "bg-indigo-400"}`} style={{ opacity: Math.max(0.38, 1 - heading.depth * 0.16) }} />
              )}
              <a href={`#${heading.id}`} title={`H${heading.level} · ${heading.text}`} className={`min-w-0 flex-1 py-2 ${accentClass}`}>
                <span className={heading.depth === 0 ? "font-semibold text-gray-700" : "font-medium"}>{heading.text}</span>
              </a>
            </div>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
