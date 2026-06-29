import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronDown, FileText, Folder, BookOpen, PenTool, ArrowLeft } from "lucide-react";
import { DocNode } from "../data";
import { useData } from "../context/DataContext";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { extractMarkdownHeadings } from "../lib/markdown";

// 递归查找第一篇文档（非文件夹）
function findFirstDoc(nodes: DocNode[]): DocNode | undefined {
  for (const node of nodes) {
    if (!node.isFolder) return node;
    if (node.children) {
      const found = findFirstDoc(node.children);
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

export function BlogPage() {
  const { posts: blogPosts, docs: knowledgeDocs } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const idFromUrl = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab") as "blog" | "docs" | "intro";

  const [activeId, setActiveId] = useState<string | null>(idFromUrl || null);
  const [activeTab, setActiveTab] = useState<"blog" | "docs" | "intro">(tabFromUrl || "intro");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["kb-1", "kb-1-1", "kb-1-2", "kb-1-2-1", "kb-1-3", "kb-1-3-1"]));
  const [tocCollapsed, setTocCollapsed] = useState(false);

  // Update URL internally
  useEffect(() => {
    if (activeTab === "intro") {
      setSearchParams({}, { replace: true });
    } else if (activeId) {
      setSearchParams({ id: activeId, tab: activeTab }, { replace: true });
    } else {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeId, activeTab, setSearchParams]);

  const findDoc = (nodes: DocNode[], id: string): DocNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findDoc(node.children, id);
        if (found) return found;
      }
    }
  };

  // 设置默认选中项；当数据异步加载后当前选中项失效时，自动回退到第一篇
  useEffect(() => {
    if (activeTab === "intro") return;
    if (activeTab === "docs") {
      const exists = activeId ? findDoc(knowledgeDocs, activeId) : undefined;
      if (!exists) {
        const first = findFirstDoc(knowledgeDocs);
        setActiveId(first?.id ?? null);
      }
    } else if (activeTab === "blog") {
      const exists = activeId ? blogPosts.find(p => p.id === activeId) : undefined;
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

  const activePost = blogPosts.find(p => p.id === activeId);
  const activeDoc = activeTab === "docs" && activeId ? findDoc(knowledgeDocs, activeId) : null;
  const activeContent =
    activeTab === "docs" && activeDoc
      ? activeDoc.content || `> ${activeDoc.title} 的内容正在维护中...`
      : activeTab === "blog" && activePost
      ? activePost.content || `${activePost.snippet}\n\n*完整内容敬请期待...*`
      : "";
  const activeHeadings = useMemo(() => extractMarkdownHeadings(activeContent, [1, 2, 3, 4]), [activeContent]);

  const scrollToPublicHeading = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTree = (nodes: DocNode[], level = 0) => {
    return (
      <ul className={level === 0 ? "space-y-1" : "mt-1 space-y-1 border-l border-gray-100"}>
        {nodes.map(node => {
          const isExpanded = expandedFolders.has(node.id);
          const isActive = activeId === node.id && activeTab === "docs";
          const indent = level === 0 ? 0 : level * 14;
          if (node.isFolder) {
            const folderTone = level === 0
              ? "text-gray-800 font-bold bg-white hover:bg-gray-50"
              : "text-gray-600 font-semibold bg-gray-50/70 hover:bg-gray-100";
            return (
              <li key={node.id} className="select-none">
                <div
                  onClick={(e) => toggleFolder(node.id, e)}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors ${folderTone}`}
                  style={{ marginLeft: indent }}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <Folder className={`w-4 h-4 ${level === 0 ? "text-teal-600" : "text-teal-500"}`} />
                  <span className={level === 0 ? "text-[15px]" : "text-sm"}>{node.title}</span>
                </div>
                <AnimatePresence>
                  {isExpanded && node.children && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {renderTree(node.children, level + 1)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          } else {
            return (
              <li key={node.id}>
                <div
                  onClick={() => {
                    setActiveId(node.id);
                    setActiveTab("docs");
                  }}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? "bg-teal-50 text-teal-700 font-semibold shadow-sm" : "hover:bg-gray-50 text-gray-500"
                  }`}
                  style={{ marginLeft: indent + 18 }}
                >
                  <FileText className={`w-3.5 h-3.5 ${isActive ? "text-teal-600" : "text-gray-400"}`} />
                  <span className="text-sm truncate">{node.title}</span>
                </div>
              </li>
            );
          }
        })}
      </ul>
    );
  };

  if (activeTab === "intro") {
    return (
      <div className="pt-20 min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-grid-pattern z-0 opacity-40 pointer-events-none" />
        <div className="max-w-4xl w-full relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> 返回主页
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-display font-black text-gray-900 tracking-tight mb-4">
              知识沉淀与经验分享
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              在这里，我记录技术探索的足迹，整理系统化的后端核心知识体系。
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blog Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => {
                setActiveTab("blog");
                setActiveId(blogPosts[0]?.id || null);
              }}
              className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all cursor-pointer group flex flex-col"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                <PenTool className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">
                博客文章
              </h2>
              <p className="text-gray-500 leading-relaxed flex-1">
                记录我在开发过程中的踩坑经验、架构思考以及对新技术栈的探索与实践。包含项目复盘、技术选型与最佳实践。
              </p>
            </motion.div>

            {/* Docs Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => {
                setActiveTab("docs");
                const firstDoc = findFirstDoc(knowledgeDocs);
                setActiveId(firstDoc?.id || null);
              }}
              className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-2xl hover:shadow-teal-500/10 hover:border-teal-100 transition-all cursor-pointer group flex flex-col"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-6 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                <BookOpen className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-teal-600 transition-colors">
                面经体系
              </h2>
              <p className="text-gray-500 leading-relaxed flex-1">
                系统化整理的后端技术栈核心知识图谱。涵盖 Java 基础、并发编程、JVM、数据库原理、中间件等高频面试考点。
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 flex flex-col md:flex-row min-h-screen bg-transparent">
      {/* Sidebar - fixed on desktop */}
      <div className="w-full md:fixed md:left-0 md:top-20 md:h-[calc(100vh-80px)] md:w-72 bg-white/80 backdrop-blur-md border-r border-gray-100 flex flex-col shrink-0 z-20">
        <div className="p-4 border-b border-gray-100">
          <button onClick={() => setActiveTab("intro")} className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> 返回知识库首页
          </button>

          {/* 博客 / 面经 切换 */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("blog");
                setActiveId(blogPosts[0]?.id || null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === "blog" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <PenTool className="w-4 h-4" /> 博客
            </button>
            <button
              onClick={() => {
                setActiveTab("docs");
                const firstDoc = findFirstDoc(knowledgeDocs);
                setActiveId(firstDoc?.id || null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === "docs" ? "bg-white text-teal-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <BookOpen className="w-4 h-4" /> 面经
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === "docs" ? (
            <div>
              {renderTree(knowledgeDocs)}
            </div>
          ) : (
            <div className="space-y-1">
              {blogPosts.map(post => {
                const isActive = activeId === post.id;
                return (
                  <div
                    key={post.id}
                    onClick={() => setActiveId(post.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      isActive ? "bg-indigo-50 border border-indigo-100 shadow-sm" : "border border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <h4 className={`text-sm font-bold leading-tight mb-2 ${isActive ? "text-indigo-900" : "text-gray-800"}`}>
                      {post.title}
                    </h4>
                    <span className="text-xs text-gray-400 block">{post.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 bg-white md:ml-72 md:min-h-[calc(100vh-80px)] ${tocCollapsed ? "xl:mr-14" : "xl:mr-72"}`}>
        <div className="max-w-4xl px-7 py-12 md:px-12 md:py-20 lg:px-20 xl:px-24 mx-auto">
          {activeTab === "docs" && activeDoc ? (
            <motion.div
              key={activeDoc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-none"
            >
              <h1 className="text-3xl md:text-4xl font-display font-black text-gray-900 mb-8 pb-8 border-b border-gray-100">
                {activeDoc.title}
              </h1>
              <MarkdownRenderer
                className="interview-markdown"
                content={activeContent}
              />
            </motion.div>
          ) : activeTab === "blog" && activePost ? (
            <motion.div
              key={activePost.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-none"
            >
              <h1 className="text-3xl md:text-5xl font-display font-black text-gray-900 mb-6 leading-tight">
                {activePost.title}
              </h1>
              <div className="flex items-center gap-4 text-sm font-medium text-gray-500 mb-12 pb-8 border-b border-gray-100">
                <span>{activePost.date}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                <span>{activePost.readTime}</span>
              </div>
              <MarkdownRenderer content={activeContent} />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
              <FileText className="w-16 h-16 mb-4 text-gray-200" />
              <p>请在左侧选择要阅读的内容</p>
            </div>
          )}
        </div>
      </div>

      <PublicHeadingToc
        headings={activeHeadings}
        collapsed={tocCollapsed}
        onToggle={() => setTocCollapsed((value) => !value)}
        onSelect={scrollToPublicHeading}
      />
    </div>
  );
}

function PublicHeadingToc({
  headings,
  collapsed,
  onToggle,
  onSelect,
}: {
  headings: ReturnType<typeof extractMarkdownHeadings>;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className={`hidden xl:flex fixed right-0 top-20 h-[calc(100vh-80px)] flex-col border-l border-gray-100 bg-white/85 backdrop-blur-md z-10 transition-all ${collapsed ? "w-14" : "w-72"}`}>
      <button
        onClick={onToggle}
        className="flex h-14 items-center justify-center border-b border-gray-100 text-xs font-bold text-gray-400 hover:bg-teal-50 hover:text-teal-600 transition-colors"
        title={collapsed ? "展开标题树" : "收起标题树"}
      >
        {collapsed ? "»" : "«"}
      </button>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {headings.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">暂无标题</p>
          ) : (
            <div className="space-y-1">
              {headings.map((heading) => (
                <button
                  key={`${heading.id}-${heading.line}`}
                  onClick={() => onSelect(heading.id)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-xs leading-5 text-gray-500 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                >
                  <span className={heading.level <= 2 ? "font-semibold text-gray-700" : ""}>{heading.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
