import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, BookOpen, Layers,
  Plus, Edit3, Trash2, ArrowLeft, Save, UploadCloud, X, LogOut, Loader2,
  ChevronRight, ChevronDown, Folder, FolderPlus, FilePlus, Briefcase
} from "lucide-react";
import type { DocNode } from "../data";

type AdminTab = "overview" | "projects" | "blog" | "docs" | "experience";

interface ApiProject {
  id: number;
  title: string;
  description: string | null;
  longDescription: string | null;
  features: string | null; // JSON 数组字符串
  tags: string | null; // JSON 数组字符串
  imageUrl: string | null;
  link: string | null;
  github: string | null;
}

interface ApiPost {
  id: number;
  title: string;
  snippet: string | null;
  date: string | null;
  readTime: string | null;
  content: string | null;
}

interface ApiExperience {
  id: number;
  company: string;
  role: string | null;
  date: string | null;
  description: string | null;
  achievements: string | null; // JSON 数组字符串
  techStack: string | null; // JSON 数组字符串
}

type EditingContext = {
  type: "project" | "blog" | "doc" | "experience";
  item: ApiProject | ApiPost | DocNode | ApiExperience | null;
  // 仅 doc 新建时使用
  parentId?: string | null;
  isFolder?: boolean;
} | null;

// 安全解析 JSON 数组字符串，失败时回退为空数组
function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 递归统计文档（非文件夹）数量
function countDocs(nodes: DocNode[]): number {
  return nodes.reduce((acc, n) => acc + (n.isFolder ? countDocs(n.children ?? []) : 1), 0);
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [editingContext, setEditingContext] = useState<EditingContext>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("adminToken"));
  const [loading, setLoading] = useState(true);

  const [apiProjects, setApiProjects] = useState<ApiProject[]>([]);
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [apiDocs, setApiDocs] = useState<DocNode[]>([]);
  const [apiExperiences, setApiExperiences] = useState<ApiExperience[]>([]);

  // Form state for editor modal
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSnippet, setFormSnippet] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formReadTime, setFormReadTime] = useState("");
  // 项目专属字段
  const [formLongDescription, setFormLongDescription] = useState("");
  const [formFeatures, setFormFeatures] = useState(""); // 每行一个特性
  const [formTags, setFormTags] = useState(""); // 逗号分隔
  const [formLink, setFormLink] = useState("");
  const [formGithub, setFormGithub] = useState("");
  // 实践历程专属字段
  const [formRole, setFormRole] = useState("");
  const [formAchievements, setFormAchievements] = useState(""); // 每行一个
  const [formTechStack, setFormTechStack] = useState(""); // 逗号分隔
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [projRes, postsRes, docsRes, expRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/posts"),
        fetch("/api/docs"),
        fetch("/api/experiences"),
      ]);
      if (projRes.ok) setApiProjects(await projRes.json());
      if (postsRes.ok) setApiPosts(await postsRes.json());
      if (docsRes.ok) setApiDocs(await docsRes.json());
      if (expRes.ok) setApiExperiences(await expRes.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (token) {
      fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem("adminToken");
            setToken(null);
          } else {
            fetchData();
          }
        })
        .catch(() => {
          localStorage.removeItem("adminToken");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, fetchData]);

  // Populate form when editing context opens
  useEffect(() => {
    if (!editingContext) return;
    // 统一重置所有字段
    setFormTitle("");
    setFormDescription("");
    setFormSnippet("");
    setFormContent("");
    setFormImageUrl("");
    setFormDate("");
    setFormReadTime("");
    setFormLongDescription("");
    setFormFeatures("");
    setFormTags("");
    setFormLink("");
    setFormGithub("");
    setFormRole("");
    setFormAchievements("");
    setFormTechStack("");

    if (!editingContext.item) {
      // 新建：仅博客需要默认日期/阅读时间
      if (editingContext.type === "blog") {
        setFormDate(new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }));
        setFormReadTime("5 分钟阅读");
      }
      return;
    }

    const item = editingContext.item;
    if (editingContext.type === "project") {
      const p = item as ApiProject;
      setFormTitle(p.title ?? "");
      setFormDescription(p.description ?? "");
      setFormLongDescription(p.longDescription ?? "");
      setFormFeatures(p.features ? safeParseArray(p.features).join("\n") : "");
      setFormTags(p.tags ? safeParseArray(p.tags).join(", ") : "");
      setFormImageUrl(p.imageUrl ?? "");
      setFormLink(p.link ?? "");
      setFormGithub(p.github ?? "");
    } else if (editingContext.type === "doc") {
      const p = item as DocNode;
      setFormTitle(p.title ?? "");
      setFormContent(p.content ?? "");
    } else if (editingContext.type === "experience") {
      const p = item as ApiExperience;
      setFormTitle(p.company ?? "");
      setFormRole(p.role ?? "");
      setFormDate(p.date ?? "");
      setFormDescription(p.description ?? "");
      setFormAchievements(p.achievements ? safeParseArray(p.achievements).join("\n") : "");
      setFormTechStack(p.techStack ? safeParseArray(p.techStack).join(", ") : "");
    } else {
      const p = item as ApiPost;
      setFormTitle(p.title ?? "");
      setFormSnippet(p.snippet ?? "");
      setFormContent(p.content ?? "");
      setFormDate(p.date ?? "");
      setFormReadTime(p.readTime ?? "");
    }
  }, [editingContext]);

  const handleSave = async () => {
    if (!editingContext) return;
    setSaving(true);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    try {
      if (editingContext.type === "project") {
        const features = formFeatures.split("\n").map((s) => s.trim()).filter(Boolean);
        const tags = formTags.split(",").map((s) => s.trim()).filter(Boolean);
        const body = {
          title: formTitle,
          description: formDescription,
          longDescription: formLongDescription,
          features: JSON.stringify(features),
          tags: JSON.stringify(tags),
          imageUrl: formImageUrl,
          link: formLink,
          github: formGithub,
        };
        if (editingContext.item) {
          await fetch(`/api/projects/${(editingContext.item as ApiProject).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          await fetch("/api/projects", { method: "POST", headers, body: JSON.stringify(body) });
        }
      } else if (editingContext.type === "doc") {
        if (editingContext.item) {
          const body = { title: formTitle, content: formContent };
          await fetch(`/api/docs/${(editingContext.item as DocNode).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          const body = {
            parentId: editingContext.parentId ?? null,
            title: formTitle,
            isFolder: editingContext.isFolder ?? false,
            content: formContent,
          };
          await fetch("/api/docs", { method: "POST", headers, body: JSON.stringify(body) });
        }
      } else if (editingContext.type === "experience") {
        const achievements = formAchievements.split("\n").map((s) => s.trim()).filter(Boolean);
        const techStack = formTechStack.split(",").map((s) => s.trim()).filter(Boolean);
        const body = {
          company: formTitle,
          role: formRole,
          date: formDate,
          description: formDescription,
          achievements: JSON.stringify(achievements),
          techStack: JSON.stringify(techStack),
        };
        if (editingContext.item) {
          await fetch(`/api/experiences/${(editingContext.item as ApiExperience).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          await fetch("/api/experiences", { method: "POST", headers, body: JSON.stringify(body) });
        }
      } else {
        const body = { title: formTitle, snippet: formSnippet, date: formDate, readTime: formReadTime, content: formContent };
        if (editingContext.item) {
          await fetch(`/api/posts/${(editingContext.item as ApiPost).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          await fetch("/api/posts", { method: "POST", headers, body: JSON.stringify(body) });
        }
      }
      await fetchData();
      setEditingContext(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: "project" | "blog" | "doc" | "experience", id: number | string, message = "确定要删除吗？") => {
    if (!confirm(message)) return;
    const headers = { Authorization: `Bearer ${token}` };
    const baseMap = { project: "projects", doc: "docs", experience: "experiences", blog: "posts" } as const;
    await fetch(`/api/${baseMap[type]}/${id}`, { method: "DELETE", headers });
    await fetchData();
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
  };

  // 当前正在编辑的面经节点是否为目录
  const editingDocIsFolder =
    editingContext?.type === "doc"
      ? editingContext.item
        ? (editingContext.item as DocNode).isFolder
        : !!editingContext.isFolder
      : false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!token) {
    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError("");
      try {
        const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "认证失败");
        localStorage.setItem("adminToken", data.token);
        setToken(data.token);
      } catch (err: any) {
        setAuthError(err.message);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> 返回主站
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
          <div className="flex items-center gap-3 text-gray-900 font-bold text-2xl tracking-tight mb-2 justify-center">
            <LayoutDashboard className="w-8 h-8 text-indigo-600" />
            内容管理中心
          </div>
          <p className="text-gray-500 text-center mb-8">{isRegistering ? "创建管理员账号" : "登录以管理您的作品集和博客"}</p>
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{authError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
            </div>
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
              {isRegistering ? "注册" : "登录"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            {isRegistering ? "已有账号？" : "初次使用？"}
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-indigo-600 font-medium ml-1 hover:underline">
              {isRegistering ? "去登录" : "创建账号"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-gray-900 font-bold text-xl tracking-tight">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            管理中心
          </div>
        </div>
        <div className="p-4 space-y-1 flex-1">
          <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="数据总览" isActive={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <NavItem icon={<Layers className="w-5 h-5" />} label="作品集管理" isActive={activeTab === "projects"} onClick={() => setActiveTab("projects")} />
          <NavItem icon={<FileText className="w-5 h-5" />} label="博客文章" isActive={activeTab === "blog"} onClick={() => setActiveTab("blog")} />
          <NavItem icon={<BookOpen className="w-5 h-5" />} label="面经体系" isActive={activeTab === "docs"} onClick={() => setActiveTab("docs")} />
          <NavItem icon={<Briefcase className="w-5 h-5" />} label="实践历程" isActive={activeTab === "experience"} onClick={() => setActiveTab("experience")} />
        </div>
        <div className="p-4 border-t border-gray-100 space-y-2">
          <Link to="/" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主站
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" /> 退出登录
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === "overview" && (
            <OverviewTab
              projectCount={apiProjects.length}
              postCount={apiPosts.length}
              docCount={countDocs(apiDocs)}
              expCount={apiExperiences.length}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === "projects" && (
            <ProjectsManager
              projects={apiProjects}
              onNew={() => setEditingContext({ type: "project", item: null })}
              onEdit={(item) => setEditingContext({ type: "project", item })}
              onDelete={(id) => handleDelete("project", id)}
            />
          )}
          {activeTab === "blog" && (
            <BlogManager
              posts={apiPosts}
              onNew={() => setEditingContext({ type: "blog", item: null })}
              onEdit={(item) => setEditingContext({ type: "blog", item })}
              onDelete={(id) => handleDelete("blog", id)}
            />
          )}
          {activeTab === "docs" && (
            <DocsManager
              docs={apiDocs}
              onNewRoot={(isFolder) => setEditingContext({ type: "doc", item: null, parentId: null, isFolder })}
              onNewChild={(parentId, isFolder) => setEditingContext({ type: "doc", item: null, parentId, isFolder })}
              onEdit={(item) => setEditingContext({ type: "doc", item })}
              onDelete={(node) =>
                handleDelete(
                  "doc",
                  node.id,
                  node.isFolder ? `确定删除目录「${node.title}」及其下所有内容吗？` : `确定删除文档「${node.title}」吗？`
                )
              }
            />
          )}
          {activeTab === "experience" && (
            <ExperienceManager
              experiences={apiExperiences}
              onNew={() => setEditingContext({ type: "experience", item: null })}
              onEdit={(item) => setEditingContext({ type: "experience", item })}
              onDelete={(item) => handleDelete("experience", item.id, `确定删除「${item.company}」这段经历吗？`)}
            />
          )}
        </div>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {editingContext && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingContext(null)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-10 bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900">
                  {editingContext.type === "doc"
                    ? editingContext.item
                      ? (editingDocIsFolder ? "重命名目录" : "编辑文档")
                      : (editingContext.isFolder ? "新建目录" : "新建文档")
                    : editingContext.type === "project"
                    ? (editingContext.item ? "编辑项目" : "新增项目")
                    : editingContext.type === "experience"
                    ? (editingContext.item ? "编辑经历" : "新增经历")
                    : (editingContext.item ? "编辑文章" : "写新文章")}
                </h3>
                <button onClick={() => setEditingContext(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {editingContext.type === "experience" ? "公司 / 组织名称" : editingContext.type === "doc" && editingDocIsFolder ? "目录名称" : "标题"}
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder={editingContext.type === "experience" ? "如：字节跳动 (ByteDance)" : "输入标题..."}
                  />
                </div>

                {editingContext.type === "project" ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">简介（卡片摘要）</label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        placeholder="一句话简介，显示在作品集卡片..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">详细描述</label>
                      <textarea
                        value={formLongDescription}
                        onChange={(e) => setFormLongDescription(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        placeholder="项目详情页展示的完整介绍..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">技术标签（逗号分隔）</label>
                        <input
                          type="text"
                          value={formTags}
                          onChange={(e) => setFormTags(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="Node.js, Redis, PostgreSQL"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">核心特性（每行一个）</label>
                        <textarea
                          value={formFeatures}
                          onChange={(e) => setFormFeatures(e.target.value)}
                          rows={1}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[48px]"
                          placeholder="多租户隔离&#10;RBAC 权限校验"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">在线访问链接（可选）</label>
                        <input
                          type="text"
                          value={formLink}
                          onChange={(e) => setFormLink(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">源码链接（可选）</label>
                        <input
                          type="text"
                          value={formGithub}
                          onChange={(e) => setFormGithub(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="https://github.com/..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">封面图片</label>
                      <div className="flex gap-3 items-start">
                        <input
                          type="text"
                          value={formImageUrl}
                          onChange={(e) => setFormImageUrl(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="图片 URL 或上传..."
                        />
                        <label className="h-12 px-4 border-2 border-dashed border-gray-200 rounded-xl flex items-center gap-2 text-gray-400 hover:text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer shrink-0">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const formData = new FormData();
                                formData.append("file", file);
                                try {
                                  const res = await fetch("/api/upload", { method: "POST", body: formData });
                                  const data = await res.json();
                                  if (data.url) setFormImageUrl(data.url);
                                } catch {
                                  alert("上传失败");
                                }
                              }
                            }}
                          />
                          <UploadCloud className="w-5 h-5" />
                          <span className="text-sm font-medium">上传</span>
                        </label>
                      </div>
                      {formImageUrl && (
                        <div className="mt-3 h-32 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                          <img src={formImageUrl} className="w-full h-full object-cover" alt="预览" />
                        </div>
                      )}
                    </div>
                  </>
                ) : editingContext.type === "blog" ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
                        <input
                          type="text"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="2026年6月24日"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">阅读时间</label>
                        <input
                          type="text"
                          value={formReadTime}
                          onChange={(e) => setFormReadTime(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="5 分钟阅读"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">摘要</label>
                      <textarea
                        value={formSnippet}
                        onChange={(e) => setFormSnippet(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        placeholder="文章摘要，显示在列表页..."
                      />
                    </div>
                  </>
                ) : editingContext.type === "experience" ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">职位 / 角色</label>
                        <input
                          type="text"
                          value={formRole}
                          onChange={(e) => setFormRole(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="如：后端研发工程师 (实习)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">时间区间</label>
                        <input
                          type="text"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="如：2025.07 - 2026.01"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">经历描述</label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        placeholder="对这段经历的整体描述..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">工作成果（每行一条）</label>
                      <textarea
                        value={formAchievements}
                        onChange={(e) => setFormAchievements(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y"
                        placeholder="主导某核心链路重构，P99 降低 40%&#10;设计轻量级配置中心方案..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">技术栈（逗号分隔）</label>
                      <input
                        type="text"
                        value={formTechStack}
                        onChange={(e) => setFormTechStack(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="Golang, Redis, Kafka, MySQL"
                      />
                    </div>
                  </>
                ) : null}

                {(editingContext.type === "blog" || (editingContext.type === "doc" && !editingDocIsFolder)) && (
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Markdown 正文内容</label>
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="w-full flex-1 min-h-[300px] p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm resize-none"
                      placeholder="支持 Markdown 语法..."
                    />
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setEditingContext(null)} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                  取消
                </button>
                <button onClick={handleSave} disabled={saving || !formTitle.trim()} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存发布
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isActive ? "bg-indigo-50 text-indigo-600 font-bold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function OverviewTab({ projectCount, postCount, docCount, expCount, onTabChange }: { projectCount: number; postCount: number; docCount: number; expCount: number; onTabChange: (tab: AdminTab) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">数据总览</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard icon={<Layers />} title="作品集" count={projectCount} onClick={() => onTabChange("projects")} color="indigo" />
        <StatCard icon={<FileText />} title="博客文章" count={postCount} onClick={() => onTabChange("blog")} color="teal" />
        <StatCard icon={<BookOpen />} title="面经文档" count={docCount} onClick={() => onTabChange("docs")} color="blue" />
        <StatCard icon={<Briefcase />} title="实践历程" count={expCount} onClick={() => onTabChange("experience")} color="amber" />
      </div>
    </motion.div>
  );
}

function StatCard({ icon, title, count, onClick, color }: { icon: React.ReactNode; title: string; count: number; onClick: () => void; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div onClick={onClick} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colorMap[color]}`}>{icon}</div>
      <div className="text-gray-500 font-medium mb-1">{title}</div>
      <div className="text-4xl font-black text-gray-900">{count}</div>
    </div>
  );
}

function ProjectsManager({
  projects,
  onNew,
  onEdit,
  onDelete,
}: {
  projects: ApiProject[];
  onNew: () => void;
  onEdit: (item: ApiProject) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">作品集管理</h1>
        <button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" /> 新增项目
        </button>
      </div>
      {projects.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <Layers className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p>暂无项目，点击右上角新增</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((p) => (
            <div key={p.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
              {p.imageUrl && (
                <div className="h-40 rounded-xl bg-gray-100 overflow-hidden">
                  <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg text-gray-900">{p.title}</h3>
                {p.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{p.description}</p>}
              </div>
              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-50">
                <button onClick={() => onEdit(p)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors text-sm">
                  <Edit3 className="w-4 h-4" /> 编辑
                </button>
                <button onClick={() => onDelete(p.id)} className="flex items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function BlogManager({
  posts,
  onNew,
  onEdit,
  onDelete,
}: {
  posts: ApiPost[];
  onNew: () => void;
  onEdit: (item: ApiPost) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">博客管理</h1>
        <button onClick={onNew} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" /> 写新文章
        </button>
      </div>
      {posts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p>暂无文章，点击右上角新建</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {posts.map((p) => (
              <div key={p.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{p.title}</h3>
                  <div className="flex gap-4 text-sm text-gray-500">
                    {p.date && <span>{p.date}</span>}
                    {p.readTime && <span>{p.readTime}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(p)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button onClick={() => onDelete(p.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ExperienceManager({
  experiences,
  onNew,
  onEdit,
  onDelete,
}: {
  experiences: ApiExperience[];
  onNew: () => void;
  onEdit: (item: ApiExperience) => void;
  onDelete: (item: ApiExperience) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">实践历程管理</h1>
        <button onClick={onNew} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" /> 新增经历
        </button>
      </div>
      {experiences.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p>暂无经历，点击右上角新增</p>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences.map((e) => {
            const tech = e.techStack ? safeParseArray(e.techStack) : [];
            return (
              <div key={e.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900">{e.company}</h3>
                    {e.role && <span className="text-sm font-medium text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">{e.role}</span>}
                  </div>
                  {e.date && <div className="text-xs font-mono text-gray-400 mt-1">{e.date}</div>}
                  {e.description && <p className="text-gray-500 text-sm mt-2 line-clamp-2">{e.description}</p>}
                  {tech.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {tech.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-500 text-xs font-medium rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onEdit(e)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button onClick={() => onDelete(e)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function DocsManager({
  docs,
  onNewRoot,
  onNewChild,
  onEdit,
  onDelete,
}: {
  docs: DocNode[];
  onNewRoot: (isFolder: boolean) => void;
  onNewChild: (parentId: string, isFolder: boolean) => void;
  onEdit: (node: DocNode) => void;
  onDelete: (node: DocNode) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">面经文档库</h1>
          <p className="text-gray-500">管理多层级的知识体系目录与文档内容</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onNewRoot(true)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <FolderPlus className="w-5 h-5" /> 新建顶级目录
          </button>
          <button onClick={() => onNewRoot(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <FilePlus className="w-5 h-5" /> 新建顶级文档
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
        {docs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p>暂无面经内容，点击右上角新建目录或文档</p>
          </div>
        ) : (
          <div className="space-y-1">
            {docs.map((node) => (
              <DocTreeNode
                key={node.id}
                node={node}
                level={0}
                onNewChild={onNewChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DocTreeNode({
  node,
  level,
  onNewChild,
  onEdit,
  onDelete,
}: {
  node: DocNode;
  level: number;
  onNewChild: (parentId: string, isFolder: boolean) => void;
  onEdit: (node: DocNode) => void;
  onDelete: (node: DocNode) => void;
}) {
  const [open, setOpen] = useState(level === 0);

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {node.isFolder ? (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
            <Folder className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-sm font-medium text-gray-700 truncate">{node.title}</span>
          </button>
        ) : (
          <button onClick={() => onEdit(node)} className="flex items-center gap-2 flex-1 min-w-0 text-left pl-6">
            <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 truncate">{node.title}</span>
          </button>
        )}

        {/* 操作按钮（hover 显示） */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {node.isFolder && (
            <>
              <button onClick={() => onNewChild(node.id, true)} title="新建子目录" className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
                <FolderPlus className="w-4 h-4" />
              </button>
              <button onClick={() => onNewChild(node.id, false)} title="新建子文档" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                <FilePlus className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => onEdit(node)} title={node.isFolder ? "重命名" : "编辑"} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(node)} title="删除" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {node.isFolder && open && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <DocTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onNewChild={onNewChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
