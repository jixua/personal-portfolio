import { motion } from "motion/react";
import { projects } from "../data";
import { ExternalLink, Github, ArrowLeft, CheckCircle2, LayoutTemplate } from "lucide-react";
import { Link } from "react-router-dom";

export function Portfolio() {
  return (
    <div className="pt-24 pb-20 px-6 min-h-screen bg-[#fafafa]">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> 返回首页
          </Link>
          <div className="flex items-center gap-3 text-indigo-600 mb-4">
            <LayoutTemplate className="w-6 h-6" />
            <span className="font-bold tracking-wider">PORTFOLIO</span>
          </div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-gray-900 tracking-tight">
            我的项目作品集
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl">
            这里展示了我参与或主导的核⼼系统项目。每个项目都包含了完整的业务思考架构设计、技术选型及最终落地的成果。
          </p>
        </motion.div>

        <div className="space-y-24">
          {projects.map((project, idx) => (
            <motion.div 
              key={project.id}
              id={`project-${project.id}`}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start scroll-mt-24"
            >
              {/* Left Side: Image container */}
              <div className={`w-full lg:w-1/2 shrink-0 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                <div className="rounded-[2.5rem] overflow-hidden bg-white shadow-2xl shadow-indigo-900/5 border border-gray-100 aspect-[4/3] group relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <img 
                    src={project.imageUrl} 
                    alt={project.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute bottom-6 left-6 right-6 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 flex gap-3">
                    {project.link && (
                      <a href={project.link} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white text-gray-900 font-bold hover:bg-indigo-50 transition-colors">
                        <ExternalLink className="w-4 h-4" /> 在线访问
                      </a>
                    )}
                    {project.github && (
                      <a href={project.github} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-colors">
                        <Github className="w-4 h-4" /> 源代码
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Content */}
              <div className={`w-full lg:w-1/2 flex flex-col ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  {project.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mb-6">
                  {project.title}
                </h2>
                
                <div className="prose prose-lg text-gray-600 mb-8">
                  <p className="text-xl text-gray-800 font-medium mb-4">{project.description}</p>
                  {project.longDescription && (
                    <p className="text-base leading-relaxed text-gray-500">{project.longDescription}</p>
                  )}
                </div>

                {project.features && project.features.length > 0 && (
                  <div className="mt-auto">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Core Features</h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {project.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-600 font-medium leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
