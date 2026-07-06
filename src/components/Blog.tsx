import { motion } from "motion/react";
import { BookOpen, Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";

export function Blog() {
  const { posts: blogPosts, loading } = useData();
  return (
    <section id="blog" className="py-24 px-6 relative z-10 overflow-hidden">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
        
        <div className="lg:col-span-4 lg:sticky lg:top-32 self-start">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-sm font-medium text-purple-600 mb-6">
            <BookOpen className="w-4 h-4" />
            <span>Articles & Notes</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6">
            思考与见解
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-md">
            写代码之余，也写一点想法。
          </p>
          <Link to="/blog" className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-gray-50 border border-gray-200 text-gray-900 font-bold hover:bg-gray-100 hover:border-gray-300 transition-all group">
            浏览全部分享 <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transform group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        <div className="lg:col-span-8 flex flex-col relative w-full border-l border-gray-100 pb-10">
          {loading ? (
            <div className="ml-8 md:ml-12 rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">
              正在读取数据库文章...
            </div>
          ) : blogPosts.length === 0 ? (
            <div className="ml-8 md:ml-12 rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">
              数据库中暂无文章内容。
            </div>
          ) : (
            blogPosts.map((post, idx) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: "easeOut" }}
                className="relative pl-8 md:pl-12 py-10 border-b border-gray-100 last:border-0 group"
              >
                {/* Highlight stroke on hover */}
                <div className="absolute left-[-1px] top-4 bottom-4 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-500 ease-out" />

                <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-200 rounded-full group-hover:border-indigo-500 group-hover:shadow-[0_0_12px_rgba(99,102,241,0.6)] transition-all duration-300" />

                <Link to={`/blog/read?id=${post.id}`} className="block">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold font-mono text-gray-400 uppercase tracking-widest mb-4">
                    <span className="flex items-center gap-1.5 text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                      <Calendar className="w-3.5 h-3.5" /> {post.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {post.readTime}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600 transition-all duration-300 inline-block">
                    {post.title}
                    <Sparkles className="inline-block w-5 h-5 ml-2 text-yellow-400 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300" />
                  </h3>

                  <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-2xl line-clamp-2">
                    {post.snippet}
                  </p>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
