import { motion } from "motion/react";
import { Layers, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";

export function Projects() {
  const { projects, loading } = useData();

  return (
    <section id="projects" className="py-20 px-6 relative z-10 flex items-center">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-sm font-medium text-indigo-600 mb-4">
              <Layers className="w-4 h-4" />
              <span>Selected Works</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-3">
              精选作品
            </h2>
            <p className="text-gray-600 font-medium max-w-xl text-base">
              一些亲手搭起来的东西。
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">
            正在读取数据库作品...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-[2rem] border border-gray-100 bg-white px-8 py-12 text-center text-sm font-medium text-gray-500">
            数据库中暂无作品内容。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 text-left">
            {projects.slice(0, 2).map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  to={`/portfolio/${project.id}`}
                  className={`group flex flex-col md:flex-row ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''} bg-white rounded-[2rem] p-2.5 border border-gray-100 shadow-xl shadow-gray-200/30 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-500 cursor-pointer h-auto md:h-[280px] lg:h-[300px] no-underline`}
                  style={{ textDecoration: "none" }}
                >
                  <div className="overflow-hidden relative rounded-[1.5rem] bg-gray-100 h-[220px] md:h-full md:w-[45%] shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 transition-opacity duration-300 group-hover:opacity-0" />
                    <img
                      src={project.thumbnailUrl || project.imageUrl}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      loading={idx === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                    <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
                      {project.tags.slice(0, 2).map((tag, tIdx) => (
                        <span key={tag} className={`px-3 py-1.5 text-xs font-bold rounded-full backdrop-blur-md shadow-sm border ${
                          tIdx === 0 ? "bg-white/80 text-indigo-700 border-white/40" : "bg-black/50 text-white border-white/10"
                        }`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 md:p-8 flex-1 flex flex-col justify-center">
                    {project.num && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        PROJECT {project.num}
                      </span>
                    )}
                    <h3 className="font-display font-bold text-xl md:text-2xl text-gray-900 mb-3 mt-1 group-hover:text-indigo-600 transition-colors">
                      {project.title}
                    </h3>
                    <p className="mb-5 flex-1 line-clamp-3 font-medium text-[16px] leading-[1.55] text-[#24315f]">
                      {project.description}
                    </p>

                    <div className="flex items-center gap-4 mt-auto pt-5 border-t border-gray-100">
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {project.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap flex items-center gap-1">
                        查看详情 <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {projects.length > 0 && (
          <div className="flex justify-center mt-8">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-gray-200 text-gray-700 font-semibold text-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
          >
            查看全部作品 <ArrowUpRight className="w-4 h-4" />
          </Link>
          </div>
        )}
      </div>
    </section>
  );
}
