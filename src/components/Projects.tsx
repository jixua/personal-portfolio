import { motion } from "motion/react";
import { projects } from "../data";
import { Layers, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Projects() {
  const navigate = useNavigate();

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
              精选作品集
            </h2>
            <p className="text-gray-600 font-medium max-w-xl text-base">
              这些是我近期深度参与构建的业务项目与开源作品，涵盖了高并发后端架构与现代化的前端交互体验。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 text-left">
          {projects.slice(0, 2).map((project, idx) => (
            <motion.div 
              key={project.id}
              layoutId={`project-card-${project.id}`}
              onClick={() => navigate(`/portfolio#project-${project.id}`)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
              className={`group flex flex-col md:flex-row ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''} bg-white rounded-[2rem] p-2.5 border border-gray-100 shadow-xl shadow-gray-200/30 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-500 cursor-pointer h-auto md:h-[280px] lg:h-[300px]`}
            >
              <div className={`overflow-hidden relative rounded-[1.5rem] bg-gray-100 h-[220px] md:h-full md:w-[45%] shrink-0`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 transition-opacity duration-300 group-hover:opacity-0" />
                <motion.img 
                  layoutId={`project-image-${project.id}`}
                  src={project.imageUrl} 
                  alt={project.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                
                {/* Floating Tags over image */}
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
              
              <div className={`p-5 md:p-8 flex-1 flex flex-col justify-center`}>
                <motion.h3 layoutId={`project-title-${project.id}`} className="font-display font-bold text-xl md:text-2xl text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">
                  {project.title}
                </motion.h3>
                <motion.p layoutId={`project-desc-${project.id}`} className="text-gray-500 text-sm md:text-base leading-relaxed mb-5 flex-1 line-clamp-3">
                  {project.description}
                </motion.p>
                
                <div className="flex items-center gap-4 mt-auto pt-5 border-t border-gray-100">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
