import { BookOpen, Briefcase, ExternalLink, FileText, Layers, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdminTab } from "./types";

const navItems = [
  { key: "overview" as const, label: "概览", icon: LayoutDashboard, accent: "text-gray-900", active: "bg-gray-100" },
  { key: "projects" as const, label: "项目", icon: Briefcase, accent: "text-gray-900", active: "bg-gray-100" },
  { key: "blog" as const, label: "博客", icon: FileText, accent: "text-[var(--signal-indigo-600)]", active: "bg-[var(--signal-indigo-50)]" },
  { key: "docs" as const, label: "面经", icon: BookOpen, accent: "text-[var(--seal)]", active: "bg-[var(--seal-50)]" },
  { key: "experience" as const, label: "经历", icon: Layers, accent: "text-gray-900", active: "bg-gray-100" },
];

const titleMap: Record<AdminTab, string> = {
  overview: "概览",
  projects: "项目",
  blog: "博客",
  docs: "面经",
  experience: "经历",
};

export function AdminShell({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapsed,
  onLogout,
  children,
}: {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-white text-gray-900">
      <nav className={`flex shrink-0 flex-col border-r border-gray-100 bg-white transition-[width,padding] duration-200 ${collapsed ? "w-[68px] px-3 py-5" : "w-[220px] px-3.5 py-5"}`}>
        <div className={`mb-5 flex items-center px-0.5 ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-gradient)] font-mono text-[13px] text-white">J</div>
            {!collapsed && <span className="truncate font-display text-[15px] font-bold text-gray-900">几许后台</span>}
          </div>
          {!collapsed && (
            <button type="button" title="收起侧边栏" onClick={onToggleCollapsed} className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100">
              <PanelLeftClose className="h-[15px] w-[15px]" />
            </button>
          )}
        </div>
        {collapsed && (
          <button type="button" title="展开侧边栏" onClick={onToggleCollapsed} className="mb-2 flex w-full items-center justify-center rounded-lg py-2 text-gray-400 transition-colors hover:bg-gray-100">
            <PanelLeftOpen className="h-[15px] w-[15px]" />
          </button>
        )}
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => onTabChange(item.key)}
                className={`flex w-full items-center gap-2.5 rounded-[10px] transition-colors ${collapsed ? "justify-center px-0 py-2.5" : "justify-start px-2.5 py-[9px]"} ${active ? `${item.active} ${item.accent}` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className={`whitespace-nowrap text-[13.5px] ${active ? "font-bold" : "font-medium"}`}>{item.label}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={onLogout} title={collapsed ? "退出登录" : undefined} className={`flex w-full items-center gap-2.5 rounded-[10px] text-gray-400 transition-colors hover:bg-gray-50 hover:text-red-500 ${collapsed ? "justify-center px-0 py-2.5" : "justify-start px-2.5 py-[9px]"}`}>
          <LogOut className="h-[15px] w-[15px]" />
          {!collapsed && <span className="whitespace-nowrap text-[13px]">退出登录</span>}
        </button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6">
          <div>
            <div className="font-display text-[15px] font-bold text-gray-900">{titleMap[activeTab]}</div>
            <div className="text-xs text-gray-400">/ admin / {activeTab}</div>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-[12.5px] text-gray-400 transition-colors hover:text-gray-900">
            <ExternalLink className="h-[13px] w-[13px]" /> 查看站点
          </Link>
        </header>
        <main className="min-h-0 flex-1 overflow-auto bg-white">{children}</main>
      </div>
    </div>
  );
}

