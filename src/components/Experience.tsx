import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Building2, Calendar, CheckCircle2, ChevronRight } from "lucide-react";
import { useData } from "../context/DataContext";

export function Experience() {
  const { experiences } = useData();
  const timelineData = [...experiences];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeExp = timelineData[Math.min(activeIndex, Math.max(0, timelineData.length - 1))];

  if (timelineData.length === 0) return null;

  return (
    <section id="experience" className="py-24 px-6 relative z-10 bg-[#fafafa]">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-4">
            实践历程
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            从校园走向职场的探索足迹，积累了不同体量业务的实战经验，持续在挑战中成长。
          </p>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/20 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          {/* LEFT: Vertical Timeline Selector */}
          <div className="md:w-1/3 bg-gray-50/50 border-b md:border-b-0 md:border-r border-gray-100 p-6 md:p-10 relative">
            <div className="absolute left-10 md:left-[3.25rem] top-10 bottom-10 w-px bg-gray-200 rounded-full hidden md:block" />
            
            <div className="flex flex-row md:flex-col gap-4 md:gap-8 overflow-x-auto md:overflow-visible custom-scrollbar pb-4 md:pb-0 relative z-10">
              {timelineData.map((exp, idx) => {
                const isActive = activeIndex === idx;
                return (
                  <div 
                    key={exp.id}
                    onClick={() => setActiveIndex(idx)}
                    className={`relative flex items-center gap-4 md:gap-6 cursor-pointer group shrink-0 md:shrink p-3 md:p-0 rounded-xl md:rounded-none transition-colors ${isActive ? 'bg-white md:bg-transparent shadow-sm md:shadow-none' : 'hover:bg-gray-100 md:hover:bg-transparent'}`}
                  >
                    {/* Timeline Node (Desktop only) */}
                    <div className="hidden md:flex relative z-10 w-6 h-6 rounded-full border-4 transition-all duration-300 bg-white items-center justify-center shrink-0" style={{ borderColor: isActive ? '#4f46e5' : '#e5e7eb' }}>
                      {isActive && <motion.div layoutId="activeDot" className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                    </div>

                    <div className="flex-1">
                      <div className={`text-xs font-mono mb-1 transition-colors ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {exp.date}
                      </div>
                      <div className={`font-bold text-sm md:text-base transition-colors ${isActive ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                        {exp.company}
                      </div>
                    </div>
                    
                    <div className="md:hidden text-gray-300">
                      <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'rotate-90 text-indigo-400' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Detail Content */}
          <div className="md:w-2/3 p-8 md:p-12 relative bg-white">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeExp.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex flex-col"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold mb-6 w-fit">
                  <Building2 className="w-4 h-4" />
                  <span>{activeExp.company}</span>
                </div>
                
                <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 leading-tight">
                  {activeExp.role}
                </h3>
                
                <div className="text-sm font-mono text-gray-500 mb-8 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {activeExp.date}
                </div>
                
                <p className="text-gray-600 leading-relaxed mb-8 text-sm md:text-base">
                  {activeExp.description}
                </p>
                
                <div className="space-y-4 mb-8">
                  {activeExp.achievements.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="text-gray-600 text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mt-auto pt-8 border-t border-gray-50">
                  {activeExp.techStack.map((tech) => (
                    <span key={tech} className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:border-gray-200 transition-colors">
                      {tech}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
