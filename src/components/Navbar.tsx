import { Github, Mail } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-gray-100" style={{ background: "rgba(250,247,241,0.85)" }}>
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="font-display font-bold text-xl tracking-tighter text-black flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-tr from-indigo-600 to-purple-500 shadow-lg shadow-indigo-500/20">
            <span className="font-mono text-xl leading-none -translate-y-[1px]">J</span>
          </div>
          <span>Jixu.dev</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-gray-500">
          <Link to={isHome ? "#about" : "/#about"} className="hover:text-indigo-600 transition-colors">关于我</Link>
          <Link to="/portfolio" className={`transition-colors ${location.pathname === "/portfolio" ? "text-indigo-600 font-bold" : "hover:text-indigo-600"}`}>作品集</Link>
          <Link to="/blog" className={`transition-colors ${location.pathname === "/blog" ? "text-indigo-600 font-bold" : "hover:text-indigo-600"}`}>博客</Link>
        </div>

        <div className="flex items-center gap-3">
          <a href="https://github.com/jixua" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all">
            <Github className="w-5 h-5" />
          </a>
          <a href="mailto:jixu0090@gmail.com" className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all md:hidden">
            <Mail className="w-5 h-5" />
          </a>
          <a href="mailto:jixu0090@gmail.com" className="hidden md:inline-flex items-center justify-center h-10 px-6 font-medium text-sm bg-gray-900 text-white rounded-full hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-300">
            联系我
          </a>
        </div>
      </div>
    </nav>
  );
}
