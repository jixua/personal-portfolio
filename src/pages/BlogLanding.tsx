import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock, PenTool, Search } from "lucide-react";
import { useData } from "../context/DataContext";
import type { BlogPost } from "../data";

type BlogTone = "indigo" | "teal" | "purple";

const tagStyles: Record<BlogTone, string> = {
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
  teal: "bg-teal-50 border-teal-100 text-teal-700",
  purple: "bg-purple-50 border-purple-100 text-purple-700",
};

function toneForTag(tag: string): BlogTone {
  const tones: BlogTone[] = ["indigo", "teal", "purple"];
  const total = Array.from(tag).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[total % tones.length];
}

function enrichPost(post: BlogPost): BlogPost & { tag: string; tagColor: BlogTone } {
  if (post.tag && post.tagColor) return { ...post, tag: post.tag, tagColor: post.tagColor };
  const tag = post.category || post.tag || "未分类";
  return { ...post, tag, tagColor: tag === "未分类" ? "indigo" : toneForTag(tag) };
}

export function BlogLanding() {
  const { posts, loading } = useData();
  const [filter, setFilter] = useState("全部");
  const [query, setQuery] = useState("");

  const enrichedPosts = useMemo(() => posts.map(enrichPost), [posts]);
  const tags = useMemo(() => ["全部", ...Array.from(new Set(enrichedPosts.map((post) => post.tag)))], [enrichedPosts]);
  const filteredPosts = enrichedPosts.filter((post) => {
    const matchesTag = filter === "全部" || post.tag === filter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || `${post.title} ${post.snippet} ${post.tag}`.toLowerCase().includes(term);
    return matchesTag && matchesQuery;
  });
  const lastUpdate = enrichedPosts[0]?.date ?? "-";

  return (
    <div className="jx-screen flex min-h-[calc(100vh-80px)] flex-col pt-20 md:flex-row">
      <aside className="shrink-0 border-b border-gray-100 bg-white/65 px-6 py-8 backdrop-blur md:sticky md:top-20 md:h-[calc(100vh-80px)] md:w-72 md:overflow-y-auto md:border-b-0 md:border-r md:px-7 md:py-10">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </Link>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600">
          <PenTool className="h-4 w-4" />
          Articles & Notes
        </div>

        <div className="mb-7 space-y-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          {[
            ["文章总数", `${enrichedPosts.length} 篇`],
            ["分类数", `${Math.max(tags.length - 1, 0)} 个`],
            ["最近更新", lastUpdate],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-gray-400">{label}</span>
              <span className="font-mono text-[13px] font-bold text-gray-900">{value}</span>
            </div>
          ))}
        </div>

        <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">按主题筛选</div>
        <div className="mb-7 flex flex-col gap-1">
          {tags.map((tag) => {
            const active = filter === tag;
            const count = tag === "全部" ? enrichedPosts.length : enrichedPosts.filter((post) => post.tag === tag).length;
            return (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <span className={`text-[13px] ${active ? "font-bold" : "font-medium"}`}>{tag}</span>
                <span className={`font-mono text-[11px] font-bold ${active ? "text-indigo-500" : "text-gray-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <label className="mb-3 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400" htmlFor="blog-search">搜索</label>
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2.5">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            id="blog-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文章标题..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
          />
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-6 py-8 md:px-11 md:py-10 xl:px-16 2xl:px-20">
        <div className="relative mb-9 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#6366f1,#a855f7,#d946ef)] px-7 py-9 shadow-[0_20px_40px_rgba(168,85,247,0.20)] md:px-11 md:py-10">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/15" />
          <div className="relative">
            <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Knowledge Base · 博客</div>
            <h1 className="mb-3 font-display text-4xl font-extrabold leading-tight text-white">思考与见解</h1>
            <p className="mb-7 max-w-lg text-[15px] font-medium leading-7 text-white/80">写代码之余，也写一点想法——记录踩过的坑、读过的源码，以及一些关于系统设计的碎碎念。</p>
            <Link to={enrichedPosts[0] ? `/blog/read?id=${enrichedPosts[0].id}` : "/blog/read"} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 bg-white/15 px-7 text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/30 active:scale-95">
              进入阅读器
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-900">{filter === "全部" ? "全部文章" : filter}</h2>
          <span className="font-mono text-xs font-bold text-gray-400">{filteredPosts.length} 篇</span>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">正在读取数据库文章...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">没有匹配的文章。</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-5">
            {filteredPosts.map((post) => (
              <Link key={post.id} to={`/blog/read?id=${post.id}`} className="group rounded-[2rem] border border-gray-100 bg-white px-7 py-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${tagStyles[post.tagColor]}`}>{post.tag}</span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-bold text-gray-400">
                    <Clock className="h-3 w-3" />
                    {post.readTime}
                  </span>
                </div>
                <h3 className="mb-2 font-display text-[19px] font-bold leading-snug text-gray-900 transition-colors group-hover:text-indigo-600">{post.title}</h3>
                <p className="mb-5 text-[13px] font-medium leading-6 text-gray-500">{post.snippet}</p>
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="font-mono text-[11px] font-bold text-gray-400">{post.date}</span>
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-400 transition-colors group-hover:text-indigo-600">
                    阅读全文
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
