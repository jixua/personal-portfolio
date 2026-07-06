import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, PenTool, Search } from "lucide-react";
import { useData } from "../context/DataContext";
import type { BlogPost } from "../data";

function postCategory(post: BlogPost) {
  return post.category || post.tag || "未分类";
}

function compactChineseDate(date: string) {
  return date.replace(/^\d{4}年/, "");
}

export function BlogLanding() {
  const { posts, loading } = useData();
  const [filter, setFilter] = useState("全部");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => ["全部", ...Array.from(new Set(posts.map(postCategory)))], [posts]);
  const filteredPosts = posts.filter((post) => {
    const category = postCategory(post);
    const matchesTag = filter === "全部" || category === filter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || `${post.title} ${post.snippet} ${category}`.toLowerCase().includes(term);
    return matchesTag && matchesQuery;
  });
  const [featuredPost, ...remainingPosts] = filteredPosts;

  return (
    <div className="jx-screen flex min-h-[calc(100vh-80px)] flex-col pt-20 md:flex-row">
      <aside className="shrink-0 border-b border-gray-100 bg-white/65 px-6 py-8 md:sticky md:top-20 md:h-[calc(100vh-80px)] md:w-72 md:overflow-y-auto md:border-b-0 md:border-r md:px-7 md:py-10">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 transition-colors duration-200 ease-in-out hover:border-indigo-200 hover:text-indigo-600">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </Link>

        <div className="mb-7 inline-flex whitespace-nowrap rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 font-mono text-[11px] font-bold text-indigo-600">
          <span className="inline-flex items-center gap-[7px]">
            <PenTool className="h-[13px] w-[13px] shrink-0" />
            Articles & Notes
          </span>
        </div>

        <div className="mb-7">
          <label className="mb-2.5 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400" htmlFor="blog-search">
            搜索
          </label>
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2.5">
            <Search className="h-[15px] w-[15px] text-gray-400" />
            <input
              id="blog-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文章标题..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">按主题筛选</div>
        <div className="flex flex-col gap-0.5">
          {categories.map((category) => {
            const active = filter === category;
            const count = category === "全部" ? posts.length : posts.filter((post) => postCategory(post) === category).length;
            return (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`flex items-center justify-between rounded-[10px] px-2.5 py-[9px] text-left transition-colors duration-200 ease-in-out ${
                  active ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                <span className={`text-[13px] ${active ? "font-bold text-indigo-700" : "font-medium text-gray-600"}`}>{category}</span>
                <span className={`font-mono text-[11px] font-bold ${active ? "text-indigo-500" : "text-gray-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-6 py-10 md:px-11 md:py-14 xl:px-16">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">Knowledge Base · 博客</div>
          <h1 className="mb-[18px] font-display text-[40px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">思考与见解</h1>
          <div className="mb-5 h-[3px] w-11 rounded-sm bg-indigo-500" />
          <p className="mb-12 max-w-[480px] text-base font-medium leading-[1.8] text-gray-600">写代码之余，也写一点想法——记录踩过的坑、读过的源码，以及一些关于系统设计的碎碎念。</p>

          {loading ? (
            <div className="py-12 text-center text-sm font-medium text-gray-500">正在读取数据库文章...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="border-t border-gray-100 py-12 text-center text-sm font-medium text-gray-500">没有匹配的文章。</div>
          ) : (
            <>
              {featuredPost && (
                <Link to={`/blog/read?id=${featuredPost.id}`} className="group block cursor-pointer border-b border-gray-100 pb-10">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 font-mono text-[11px] font-bold text-indigo-700">{postCategory(featuredPost)}</span>
                    <span className="font-mono text-[11px] font-bold text-gray-400">最新</span>
                  </div>
                  <h2 className="mb-3.5 font-display text-[30px] font-extrabold leading-[1.25] text-gray-900 transition-colors duration-200 ease-in-out group-hover:text-indigo-600">{featuredPost.title}</h2>
                  <p className="mb-5 max-w-[620px] text-base leading-[1.75] text-gray-500">{featuredPost.snippet}</p>
                  <div className="flex items-center gap-4 font-mono text-xs font-semibold text-gray-400">
                    <span>{featuredPost.date}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-gray-300" />
                    <span>{featuredPost.readTime}</span>
                    <span className="ml-auto inline-flex items-center gap-1.5 font-sans text-[13px] font-bold text-indigo-600">
                      阅读全文
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              )}

              <div>
                {remainingPosts.map((post) => (
                  <Link key={post.id} to={`/blog/read?id=${post.id}`} className="group flex cursor-pointer items-baseline gap-6 border-b border-gray-100 py-[26px]">
                    <div className="w-24 shrink-0 font-mono text-xs font-semibold text-gray-400">{compactChineseDate(post.date)}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1.5 font-display text-lg font-bold text-gray-900 transition-colors duration-200 ease-in-out group-hover:text-indigo-600">{post.title}</h3>
                      <p className="truncate text-sm leading-[1.6] text-gray-500">{post.snippet}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3.5">
                      <span className="whitespace-nowrap font-mono text-[11px] font-bold text-gray-400">{post.readTime}</span>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 transition-all duration-200 ease-in-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-500" />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
