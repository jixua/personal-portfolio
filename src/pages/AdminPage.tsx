import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LayoutDashboard, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminShell } from "./admin/Shell";
import { BlogEditorScreen, DocsEditorScreen, ExperienceScreen, OverviewScreen, ProjectsScreen } from "./admin/Screens";
import { extractMarkdownImagePaths, findMarkdownAssetFile, replaceMarkdownAssetPath } from "./admin/fileHelpers";
import type { ApiExperience, ApiPost, ApiProject, AdminTab } from "./admin/types";
import type { DocNode } from "../data";
import { useData } from "../context/DataContext";

type PendingMarkdownImport = {
  markdown: string;
  markdownFile: File;
  imagePaths: string[];
  apply: (markdown: string, file: File) => void;
};

export function AdminPage() {
  const { refresh: refreshSiteData } = useData();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("adminToken"));
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [apiProjects, setApiProjects] = useState<ApiProject[]>([]);
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [apiDocs, setApiDocs] = useState<DocNode[]>([]);
  const [apiExperiences, setApiExperiences] = useState<ApiExperience[]>([]);
  const assetImportInputRef = useRef<HTMLInputElement | null>(null);
  const assetFileImportInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingMarkdownImport, setPendingMarkdownImport] = useState<PendingMarkdownImport | null>(null);

  useEffect(() => {
    if (activeTab === "blog" || activeTab === "docs") setNavCollapsed(true);
  }, [activeTab]);

  const fetchData = useCallback(async () => {
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
  }, []);

  const refreshAllData = useCallback(async () => {
    await fetchData();
    await refreshSiteData();
  }, [fetchData, refreshSiteData]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) {
          localStorage.removeItem("adminToken");
          setToken(null);
          return;
        }
        return fetchData();
      })
      .catch(() => {
        localStorage.removeItem("adminToken");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token, fetchData]);

  const uploadMarkdownAsset = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: fd });
    if (!response.ok) throw new Error(`上传失败：${file.name}`);
    const data = await response.json();
    if (!data.url) throw new Error(`上传失败：${file.name}`);
    return data.url as string;
  };

  const resolveMarkdownAssets = async (markdown: string, markdownFile: File, imagePaths: string[], files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((file) => file.type.startsWith("image/"));
    const unmatched: string[] = [];
    for (const imagePath of imagePaths) {
      const imageFile = findMarkdownAssetFile(imageFiles, markdownFile, imagePath);
      if (!imageFile) {
        unmatched.push(imagePath);
        continue;
      }
      markdown = replaceMarkdownAssetPath(markdown, imagePath, await uploadMarkdownAsset(imageFile));
    }
    return { markdown, unmatched };
  };

  const importMarkdown = async (files: FileList | null, apply: (markdown: string, file: File) => void) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const markdownFile = fileArray.find((file) => /\.(md|markdown)$/i.test(file.name));
    if (!markdownFile) {
      alert("请选择一个 .md 或 .markdown 文件");
      return;
    }
    let markdown = await markdownFile.text();
    const imagePaths = extractMarkdownImagePaths(markdown);
    const imageFiles = fileArray.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length > 0 && imagePaths.length > 0) {
      const resolved = await resolveMarkdownAssets(markdown, markdownFile, imagePaths, imageFiles);
      markdown = resolved.markdown;
      if (resolved.unmatched.length > 0) {
        setPendingMarkdownImport({ markdown, markdownFile, imagePaths: resolved.unmatched, apply });
        setTimeout(() => assetImportInputRef.current?.click(), 0);
        alert(`还有 ${resolved.unmatched.length} 张图片未找到，请继续选择图片所在文件夹或图片文件。`);
      } else {
        setPendingMarkdownImport(null);
      }
    } else if (imagePaths.length > 0) {
      setPendingMarkdownImport({ markdown, markdownFile, imagePaths, apply });
      setTimeout(() => assetImportInputRef.current?.click(), 0);
      alert(`检测到 ${imagePaths.length} 张本地图片引用，请选择图片所在文件夹或图片文件。`);
    } else {
      setPendingMarkdownImport(null);
    }
    apply(markdown, markdownFile);
  };

  const importAssetsForPendingMarkdown = async (files: FileList | null) => {
    if (!files || !pendingMarkdownImport) return;
    const resolved = await resolveMarkdownAssets(
      pendingMarkdownImport.markdown,
      pendingMarkdownImport.markdownFile,
      pendingMarkdownImport.imagePaths,
      files,
    );
    pendingMarkdownImport.apply(resolved.markdown, pendingMarkdownImport.markdownFile);
    if (resolved.unmatched.length > 0) {
      setPendingMarkdownImport({ ...pendingMarkdownImport, markdown: resolved.markdown, imagePaths: resolved.unmatched });
      alert(`仍有 ${resolved.unmatched.length} 张图片没有找到，路径已保留：\n${resolved.unmatched.join("\n")}`);
    } else {
      setPendingMarkdownImport(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  if (!token) {
    const handleAuth = async (event: React.FormEvent) => {
      event.preventDefault();
      setAuthError("");
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "认证失败");
        localStorage.setItem("adminToken", data.token);
        setToken(data.token);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "认证失败");
      }
    };

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> 返回主站
        </Link>
        <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50">
          <div className="mb-2 flex items-center justify-center gap-3 text-2xl font-bold tracking-tight text-gray-900">
            <LayoutDashboard className="h-8 w-8 text-indigo-600" /> 内容管理中心
          </div>
          <p className="mb-8 text-center text-gray-500">登录以管理您的作品集和博客</p>
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{authError}</div>}
            <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" /></label>
            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition-colors hover:bg-indigo-700">登录</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={assetImportInputRef}
        type="file"
        className="hidden"
        multiple
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={async (event) => {
          try {
            await importAssetsForPendingMarkdown(event.target.files);
          } catch (error) {
            alert(error instanceof Error ? error.message : "导入失败");
          } finally {
            event.currentTarget.value = "";
          }
        }}
      />
      <input
        ref={assetFileImportInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*"
        onChange={async (event) => {
          try {
            await importAssetsForPendingMarkdown(event.target.files);
          } catch (error) {
            alert(error instanceof Error ? error.message : "导入失败");
          } finally {
            event.currentTarget.value = "";
          }
        }}
      />
      <AdminShell activeTab={activeTab} onTabChange={setActiveTab} collapsed={navCollapsed} onToggleCollapsed={() => setNavCollapsed((value) => !value)} onLogout={handleLogout}>
        {activeTab === "overview" && <OverviewScreen projects={apiProjects} posts={apiPosts} docs={apiDocs} experiences={apiExperiences} onTabChange={setActiveTab} />}
        {activeTab === "projects" && <ProjectsScreen projects={apiProjects} token={token} uploadMarkdownAsset={uploadMarkdownAsset} onRefresh={refreshAllData} />}
        {activeTab === "blog" && (
          <BlogEditorScreen
            posts={apiPosts}
            token={token}
            uploadMarkdownAsset={uploadMarkdownAsset}
            importMarkdown={importMarkdown}
            pendingImportCount={pendingMarkdownImport?.imagePaths.length ?? 0}
            requestAssetDirectory={() => assetImportInputRef.current?.click()}
            requestAssetFiles={() => assetFileImportInputRef.current?.click()}
            onRefresh={refreshAllData}
          />
        )}
        {activeTab === "docs" && (
          <DocsEditorScreen
            docs={apiDocs}
            token={token}
            uploadMarkdownAsset={uploadMarkdownAsset}
            importMarkdown={importMarkdown}
            pendingImportCount={pendingMarkdownImport?.imagePaths.length ?? 0}
            requestAssetDirectory={() => assetImportInputRef.current?.click()}
            requestAssetFiles={() => assetFileImportInputRef.current?.click()}
            onRefresh={refreshAllData}
          />
        )}
        {activeTab === "experience" && <ExperienceScreen experiences={apiExperiences} token={token} onRefresh={refreshAllData} />}
      </AdminShell>
    </>
  );
}
