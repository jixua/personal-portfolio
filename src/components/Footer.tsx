import { Github, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        <div className="flex flex-col items-center md:items-start">
          <div className="font-sans font-bold text-xl tracking-tighter text-black flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-black rounded-md flex items-center justify-center text-white">
              <span className="font-mono text-sm leading-none -translate-y-[1px]">J</span>
            </div>
            <span>Jixu.dev</span>
          </div>
          <p className="text-sm text-gray-500 font-mono">
            &copy; {new Date().getFullYear()} Jixu. All rights reserved.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/admin" className="p-3 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all" title="内容管理后台">
            <Lock className="w-5 h-5" />
          </Link>
          <a href="https://github.com/jixua" target="_blank" rel="noopener noreferrer" className="p-3 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all">
            <Github className="w-5 h-5" />
          </a>
        </div>
        
      </div>
    </footer>
  );
}
