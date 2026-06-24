import { motion } from "motion/react";
import { ArrowRight, Download, Database, Activity, Sparkles, Bot, Server, Cpu, Network, Workflow, Layers } from "lucide-react";
import { skills } from "../data";

export function Hero() {
  return (
    <section id="about" className="relative min-h-[100dvh] pt-32 pb-16 px-6 max-w-6xl mx-auto z-10 w-full flex flex-col justify-center">
      {/* Very subtle background light */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-100/50 blur-[100px] opacity-60 pointer-events-none z-[-1]"></div>
      
      <div className="flex flex-col lg:flex-row items-center lg:items-center justify-between gap-16 lg:gap-12">
        
        {/* Left Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 w-full flex flex-col items-start text-left"
        >
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-mono text-gray-600 mb-8 shadow-sm">
             <span className="relative flex w-2.5 h-2.5">
               <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
               <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500"></span>
             </span>
             <span>Available for new opportunities</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-6">
            专注于构建<br />
            <span className="text-indigo-600">
              稳定可靠的后端服务.
            </span>
          </h1>

          <p className="text-lg text-gray-600 font-medium leading-relaxed max-w-lg mb-10">
            您好，我是 Jixu，一名后端开发工程师。我致力于编写整洁、可维护的代码，设计稳定的业务架构。同时，我也在探索将 AI 大模型与 Agent 技术融入后端生态，以实现开发提效与服务智能化。
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a href="#projects" className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-gray-900 text-white font-medium hover:bg-gray-800 active:scale-95 transition-all duration-300 shadow-sm">
              查看项目经验 <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#experience" className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-white border border-gray-200 text-gray-900 font-medium hover:bg-gray-50 active:scale-95 transition-all duration-300 shadow-sm hover:shadow">
               个人经历
            </a>
          </div>
        </motion.div>

        {/* Right Side: Bento Box Widgets */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full lg:w-[520px] shrink-0 relative mt-8 lg:mt-0 grid grid-cols-2 gap-4"
        >
          {/* System Load Widget */}
          <div className="col-span-2 bg-white/80 backdrop-blur-xl border border-gray-100 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] transition-all duration-500 overflow-hidden group">
             <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                  <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    System Traffic
                  </h3>
                  <p className="text-sm font-mono text-gray-500 mt-1">requests / second</p>
                </div>
                <div className="flex items-baseline gap-1 text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl">
                  <span className="font-display font-black text-2xl md:text-3xl">12k</span>
                  <span className="font-bold text-sm">/s</span>
                </div>
             </div>
             
             {/* Animated Chart Bars */}
             <div className="flex items-end justify-between h-24 md:h-28 gap-1.5 pb-2 border-b border-gray-100 relative z-10">
                {[40, 25, 45, 30, 60, 80, 50, 70, 40, 60, 90, 75, 45, 65, 85, 100].map((h, i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: "10%" }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", delay: i * 0.1, ease: "easeInOut" }}
                    className={`w-full rounded-t-md ${i > 11 ? 'bg-gradient-to-t from-indigo-500 to-purple-500' : 'bg-indigo-100'}`}
                  />
                ))}
             </div>
          </div>

          {/* Event Streams Widget */}
          <div className="col-span-2 sm:col-span-1 bg-white border border-gray-100 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-500 overflow-hidden flex flex-col justify-between group">
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 bg-orange-50 rounded-[12px] flex items-center justify-center shrink-0 border border-orange-100/50 group-hover:scale-110 transition-transform">
                  <Workflow className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-gray-900 leading-tight">消息队列</h4>
                  <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Event Streams</p>
                </div>
            </div>
            
            <div className="space-y-2.5">
              {/* row 1 */}
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-mono text-gray-400 w-12 text-right">Topic A</div>
                <div className="flex-1 h-6 bg-gray-50 rounded-md flex px-1 items-center gap-1 overflow-hidden relative">
                  <motion.div initial={{ left: "-10%" }} animate={{ left: "110%" }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-4 h-4 rounded bg-orange-200 border border-orange-300 absolute"></motion.div>
                </div>
              </div>
              {/* row 2 */}
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-mono text-gray-400 w-12 text-right">Topic B</div>
                <div className="flex-1 h-6 bg-gray-50 rounded-md flex px-1 items-center gap-1 overflow-hidden relative">
                  <motion.div initial={{ left: "-10%" }} animate={{ left: "110%" }} transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: "linear" }} className="w-4 h-4 rounded bg-blue-200 border border-blue-300 shadow-sm absolute"></motion.div>
                </div>
              </div>
              {/* row 3 */}
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-mono text-gray-400 w-12 text-right">DLQ</div>
                <div className="flex-1 h-6 bg-gray-50 rounded-md flex px-1 items-center gap-2 overflow-hidden">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-300 ml-1"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-300"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Vector Search Widget */}
          <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 rounded-[2rem] p-6 shadow-xl shadow-purple-500/20 text-white relative overflow-hidden group hover:-translate-y-1 transition-transform duration-500">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-[12px] flex items-center justify-center border border-white/20 backdrop-blur-md group-hover:rotate-12 transition-transform">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div className="px-2.5 py-1 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm text-[10px] font-bold tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-fuchsia-300" /> AI
                </div>
              </div>
              
              <div className="mt-auto">
                <h4 className="font-display font-bold text-white text-lg leading-tight mb-1">向量检索</h4>
                <p className="text-[11px] text-indigo-100 font-medium mb-4 uppercase tracking-wider">Vector Embeddings</p>
                
                <div className="bg-black/20 rounded-xl p-3 border border-white/10 backdrop-blur-sm font-mono text-[10px] text-indigo-100 space-y-2">
                  <div className="flex justify-between items-center">
                      <span className="opacity-70">Dim</span>
                      <span className="font-bold text-white">1536</span>
                  </div>
                  <div className="w-full h-px bg-white/10"></div>
                  <div className="flex gap-1 overflow-hidden whitespace-nowrap">
                     <span className="text-emerald-300">[0.84</span>
                     <span className="text-gray-300">-0.11</span>
                     <span className="text-emerald-300">0.99</span>
                     <span className="text-gray-300">...]</span>
                  </div>
                  <div className="w-full h-px bg-white/10"></div>
                  <div className="flex justify-between items-center">
                      <span className="opacity-70">Top-1 Score</span>
                      <span className="font-bold text-fuchsia-300">0.982</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </section>
  );
}
