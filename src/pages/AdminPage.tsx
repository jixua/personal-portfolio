import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, BookOpen, Layers,
  Plus, Edit3, Trash2, ArrowLeft, Save, UploadCloud, X, LogOut, Loader2,
  ChevronRight, ChevronDown, Folder, FolderPlus, FilePlus, Briefcase, GripVertical,
  Search, PanelLeftClose
} from "lucide-react";
import type { DocNode } from "../data";
import { useData } from "../context/DataContext";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { extractMarkdownHeadings } from "../lib/markdown";

type AdminTab = "overview" | "projects" | "blog" | "docs" | "experience";
type UploadMarkdownAsset = (file: File) => Promise<string>;

interface ApiProject {
  id: number;
  sortOrder: number | null;
  num: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  longDescription: string | null;
  overview: string | null;
  detail: string | null;
  category: string | null;
  role: string | null;
  period: string | null;
  features: string | null; // JSON 数组字符串（对象数组）
  tags: string | null;     // JSON 数组字符串
  stack: string | null;    // JSON 数组字符串
  imageUrl: string | null;
  link: string | null;
  github: string | null;
}

interface FeatureRow {
  title: string;
  detail: string;
  doc: string;
}

interface ApiPost {
  id: number;
  sortOrder: number | null;
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

function reorderIds<T extends { id: number | string }>(items: T[], draggedId: number | string, targetId: number | string) {
  const ids = items.map((item) => item.id);
  const from = ids.findIndex((id) => String(id) === String(draggedId));
  const to = ids.findIndex((id) => String(id) === String(targetId));
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

type DocDropPosition = "before" | "inside" | "after";

function findDocParentInfo(nodes: DocNode[], id: string, parentId: string | null = null): { node: DocNode; parentId: string | null; siblings: DocNode[] } | null {
  for (const node of nodes) {
    if (node.id === id) return { node, parentId, siblings: nodes };
    if (node.children) {
      const found = findDocParentInfo(node.children, id, node.id);
      if (found) return found;
    }
  }
  return null;
}

function isDocDescendant(parent: DocNode, possibleChildId: string): boolean {
  return (parent.children ?? []).some((child) => child.id === possibleChildId || isDocDescendant(child, possibleChildId));
}

function withoutDocId(nodes: DocNode[], id: string) {
  return nodes.filter((node) => node.id !== id);
}

function insertDocId(ids: string[], movedId: string, targetId: string, position: Exclude<DocDropPosition, "inside">) {
  const next = ids.filter((id) => id !== movedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) return next;
  next.splice(position === "before" ? targetIndex : targetIndex + 1, 0, movedId);
  return next;
}

function isRemoteOrRootPath(src: string) {
  return /^(https?:)?\/\//i.test(src) || src.startsWith("data:") || src.startsWith("/") || src.startsWith("#");
}

function normalizeAssetPath(path: string) {
  return decodeURIComponent(path)
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .trim();
}

function assetFileName(path: string) {
  return normalizeAssetPath(path).split("/").pop() || normalizeAssetPath(path);
}

function normalizeRelativePath(path: string) {
  const parts: string[] = [];
  for (const part of normalizeAssetPath(path).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function joinRelativePath(baseDir: string, targetPath: string) {
  if (!baseDir) return normalizeRelativePath(targetPath);
  return normalizeRelativePath(`${baseDir}/${targetPath}`);
}

function getFileRelativePath(file: File) {
  return normalizeRelativePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
}

function getDirname(path: string) {
  const normalized = normalizeRelativePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function findMarkdownAssetFile(
  imageFiles: File[],
  byRelativePath: Map<string, File>,
  byName: Map<string, File>,
  markdownFile: File,
  imagePath: string,
) {
  const markdownRelativePath = getFileRelativePath(markdownFile);
  const markdownDir = getDirname(markdownRelativePath);
  const resolvedFromMarkdown = joinRelativePath(markdownDir, imagePath);
  const normalizedPath = normalizeAssetPath(imagePath);
  const fileName = assetFileName(imagePath);
  return (
    byRelativePath.get(resolvedFromMarkdown) ||
    byRelativePath.get(normalizedPath) ||
    byName.get(fileName) ||
    imageFiles.find((file) => {
      const relativePath = getFileRelativePath(file);
      return (
        relativePath === resolvedFromMarkdown ||
        relativePath.endsWith(`/${resolvedFromMarkdown}`) ||
        relativePath.endsWith(`/${normalizedPath}`) ||
        relativePath.endsWith(`/${fileName}`) ||
        normalizedPath.endsWith(`/${relativePath}`)
      );
    }) ||
    null
  );
}

function extractMarkdownImagePaths(markdown: string) {
  const paths = new Set<string>();
  const markdownImagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const htmlImagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const wikiImagePattern = /!\[\[([^\]|]+)(?:\|[^\]]*)?]]/g;

  for (const pattern of [markdownImagePattern, htmlImagePattern, wikiImagePattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(markdown))) {
      const src = match[1].trim();
      if (!isRemoteOrRootPath(src)) paths.add(src);
    }
  }

  return Array.from(paths);
}

function replaceMarkdownAssetPath(markdown: string, originalPath: string, uploadedUrl: string) {
  const escaped = originalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alt = originalPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "图片";
  return markdown
    .replace(new RegExp(`!\\[\\[${escaped}(?:\\|([^\\]]*))?]]`, "g"), (_match, label) => {
      return `![${label || alt}](${uploadedUrl})`;
    })
    .replace(new RegExp(escaped, "g"), uploadedUrl);
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

function flattenDocs(nodes: DocNode[], trail: string[] = []): Array<{ node: DocNode; trail: string[] }> {
  return nodes.flatMap((node) => {
    const nextTrail = [...trail, node.title];
    return [
      { node, trail: nextTrail },
      ...(node.children ? flattenDocs(node.children, nextTrail) : []),
    ];
  });
}

export function AdminPage() {
  const { refresh: refreshSiteData } = useData();
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
  const [formNum, setFormNum] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formOverview, setFormOverview] = useState("");
  const [formDetail, setFormDetail] = useState("");
  const formDetailRef = useRef<HTMLTextAreaElement | null>(null);
  const [projectDetailPasteUploadCount, setProjectDetailPasteUploadCount] = useState(0);
  const [formLongDescription, setFormLongDescription] = useState("");
  const [formFeatureRows, setFormFeatureRows] = useState<FeatureRow[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const assetImportInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingMarkdownImport, setPendingMarkdownImport] = useState<{
    markdown: string;
    markdownFile: File;
    imagePaths: string[];
  } | null>(null);
  const [formTags, setFormTags] = useState(""); // 逗号分隔
  const [formStack, setFormStack] = useState(""); // 逗号分隔
  const [formLink, setFormLink] = useState("");
  const [formGithub, setFormGithub] = useState("");
  // 实践历程专属字段
  const [formRole, setFormRole] = useState("");
  const [formAchievements, setFormAchievements] = useState(""); // 每行一个
  const [formTechStack, setFormTechStack] = useState(""); // 逗号分隔
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const refreshAllData = useCallback(async () => {
    await fetchData();
    await refreshSiteData();
  }, [fetchData, refreshSiteData]);

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
    setFormNum("");
    setFormSubtitle("");
    setFormCategory("");
    setFormPeriod("");
    setFormOverview("");
    setFormDetail("");
    setFormLongDescription("");
    setFormFeatureRows([]);
    setFormTags("");
    setFormStack("");
    setFormLink("");
    setFormGithub("");
    setFormRole("");
    setFormAchievements("");
    setFormTechStack("");

    if (!editingContext.item) {
      if (editingContext.type === "blog") {
        setFormDate(new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }));
        setFormReadTime("5 分钟阅读");
      }
      return;
    }

    const item = editingContext.item;
    if (editingContext.type === "project") {
      const p = item as ApiProject;
      setFormNum(p.num ?? "");
      setFormTitle(p.title ?? "");
      setFormSubtitle(p.subtitle ?? "");
      setFormCategory(p.category ?? "");
      setFormDescription(p.description ?? "");
      setFormPeriod(p.period ?? "");
      setFormOverview(p.overview ?? "");
      setFormDetail(p.detail ?? "");
      setFormLongDescription(p.longDescription ?? "");
      // parse features — support both string[] and {title,detail,doc}[]
      if (p.features) {
        try {
          const parsed = JSON.parse(p.features);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (typeof parsed[0] === "string") {
              setFormFeatureRows(parsed.map((s: string) => ({ title: s, detail: "", doc: "#" })));
            } else {
              setFormFeatureRows(parsed.map((f: any) => ({ title: f.title ?? "", detail: f.detail ?? "", doc: f.doc ?? "#" })));
            }
          }
        } catch {}
      }
      setFormTags(p.tags ? safeParseArray(p.tags).join(", ") : "");
      setFormStack(p.stack ? safeParseArray(p.stack).join(", ") : "");
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
    const saveJson = async (url: string, init: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) {
        let message = "保存失败";
        try {
          const data = await response.json();
          message = data?.error || message;
        } catch {}
        throw new Error(message);
      }
      return response;
    };
    try {
      if (editingContext.type === "project") {
        const tags = formTags.split(",").map((s) => s.trim()).filter(Boolean);
        const stack = formStack.split(",").map((s) => s.trim()).filter(Boolean);
        const features = formFeatureRows.filter((r) => r.title.trim());
        const body = {
          num: formNum,
          title: formTitle,
          subtitle: formSubtitle,
          category: formCategory,
          description: formDescription,
          longDescription: formLongDescription,
          overview: formOverview,
          detail: formDetail,
          role: formRole,
          period: formPeriod,
          features: JSON.stringify(features),
          tags: JSON.stringify(tags),
          stack: JSON.stringify(stack),
          imageUrl: formImageUrl,
          link: formLink,
          github: formGithub,
        };
        if (editingContext.item) {
          await saveJson(`/api/projects/${(editingContext.item as ApiProject).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          await saveJson("/api/projects", { method: "POST", headers, body: JSON.stringify(body) });
        }
      } else if (editingContext.type === "doc") {
        if (editingContext.item) {
          const body = { title: formTitle, content: formContent };
          await saveJson(`/api/docs/${(editingContext.item as DocNode).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          const body = {
            parentId: editingContext.parentId ?? null,
            title: formTitle,
            isFolder: editingContext.isFolder ?? false,
            content: formContent,
          };
          await saveJson("/api/docs", { method: "POST", headers, body: JSON.stringify(body) });
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
          await saveJson(`/api/experiences/${(editingContext.item as ApiExperience).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          await saveJson("/api/experiences", { method: "POST", headers, body: JSON.stringify(body) });
        }
      } else {
        const body = { title: formTitle, snippet: formSnippet, date: formDate, readTime: formReadTime, content: formContent };
        if (editingContext.item) {
          await saveJson(`/api/posts/${(editingContext.item as ApiPost).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        } else {
          await saveJson("/api/posts", { method: "POST", headers, body: JSON.stringify(body) });
        }
      }
      await refreshAllData();
      setEditingContext(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: "project" | "blog" | "doc" | "experience", id: number | string, message = "确定要删除吗？", skipConfirm = false) => {
    if (!skipConfirm && !confirm(message)) return;
    const headers = { Authorization: `Bearer ${token}` };
    const baseMap = { project: "projects", doc: "docs", experience: "experiences", blog: "posts" } as const;
    await fetch(`/api/${baseMap[type]}/${id}`, { method: "DELETE", headers });
    await refreshAllData();
  };

  const saveOrder = async (type: "projects" | "posts" | "docs", ids: Array<number | string>) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    await fetch(`/api/${type}/reorder`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ ids }),
    });
    await refreshAllData();
  };

  const handleProjectReorder = async (ids: Array<number | string>) => {
    setApiProjects((items) => ids.map((id) => items.find((item) => String(item.id) === String(id))).filter(Boolean) as ApiProject[]);
    await saveOrder("projects", ids);
  };

  const handlePostReorder = async (ids: Array<number | string>) => {
    setApiPosts((items) => ids.map((id) => items.find((item) => String(item.id) === String(id))).filter(Boolean) as ApiPost[]);
    await saveOrder("posts", ids);
  };

  const handleDocReorder = async (ids: Array<number | string>) => {
    await saveOrder("docs", ids);
  };

  const handleDocMove = async (payload: {
    movedId: string;
    newParentId: string | null;
    oldSiblingIds: string[];
    newSiblingIds: string[];
  }) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    await fetch("/api/docs/move", {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    await refreshAllData();
  };

  const uploadMarkdownAsset = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`上传失败：${file.name}`);
    const data = await res.json();
    if (!data.url) throw new Error(`上传失败：${file.name}`);
    return data.url as string;
  };

  const insertProjectDetailMarkdown = (markdown: string) => {
    const textarea = formDetailRef.current;
    if (!textarea) {
      setFormDetail((value) => `${value}${value.endsWith("\n") || value.length === 0 ? "" : "\n\n"}${markdown}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formDetail.slice(0, start);
    const after = formDetail.slice(end);
    const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n\n";
    const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n\n";
    const next = `${before}${prefix}${markdown}${suffix}${after}`;
    const cursor = before.length + prefix.length + markdown.length;
    setFormDetail(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const importProjectDetailImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      alert("请选择图片文件");
      return;
    }

    try {
      const markdownItems = await Promise.all(
        imageFiles.map(async (file) => {
          const url = await uploadMarkdownAsset(file);
          return `![${file.name.replace(/\.[^.]+$/, "")}](${url})`;
        }),
      );
      insertProjectDetailMarkdown(markdownItems.join("\n\n"));
    } catch (error) {
      alert(error instanceof Error ? error.message : "图片上传失败");
    }
  };

  const replaceProjectDetailMarkdown = (search: string, replacement: string) => {
    setFormDetail((current) => {
      const index = current.indexOf(search);
      if (index === -1) return current;
      return `${current.slice(0, index)}${replacement}${current.slice(index + search.length)}`;
    });
  };

  const handleProjectDetailPasteImages = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = getClipboardImageFiles(event.clipboardData);
    if (images.length === 0) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const pastedAt = Date.now();
    const placeholders = images.map((_, index) => `![图片上传中 ${index + 1}](uploading://project-detail-image-${pastedAt}-${index})`);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formDetail.slice(0, start);
    const after = formDetail.slice(end);
    const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n\n";
    const markdown = placeholders.join("\n\n");
    const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n\n";
    const next = `${before}${prefix}${markdown}${suffix}${after}`;
    const cursor = before.length + prefix.length + markdown.length;
    setFormDetail(next);
    setProjectDetailPasteUploadCount((count) => count + images.length);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });

    await Promise.all(
      images.map(async (file, index) => {
        const placeholder = placeholders[index];
        try {
          const url = await uploadMarkdownAsset(file);
          replaceProjectDetailMarkdown(placeholder, `![${getImageAltText(file, index)}](${url})`);
        } catch (error) {
          replaceProjectDetailMarkdown(placeholder, `<!-- 图片上传失败：${file.name || `clipboard-image-${index + 1}`} -->`);
          alert(error instanceof Error ? error.message : "图片上传失败");
        } finally {
          setProjectDetailPasteUploadCount((count) => Math.max(0, count - 1));
        }
      }),
    );
  };

  const resolveMarkdownAssets = async (
    markdown: string,
    markdownFile: File,
    imagePaths: string[],
    files: FileList | File[],
  ) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((file) => file.type.startsWith("image/"));
    const unmatched: string[] = [];
    const byRelativePath = new Map<string, File>();
    const byName = new Map<string, File>();
    imageFiles.forEach((file) => {
      const relativePath = getFileRelativePath(file);
      byRelativePath.set(relativePath, file);
      byName.set(file.name, file);
    });

    for (const imagePath of imagePaths) {
      const imageFile = findMarkdownAssetFile(imageFiles, byRelativePath, byName, markdownFile, imagePath);
      if (!imageFile) {
        unmatched.push(imagePath);
        continue;
      }
      const uploadedUrl = await uploadMarkdownAsset(imageFile);
      markdown = replaceMarkdownAssetPath(markdown, imagePath, uploadedUrl);
    }

    return { markdown, unmatched };
  };

  const importMarkdownOnly = async (files: FileList | null) => {
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
        setPendingMarkdownImport({ markdown, markdownFile, imagePaths: resolved.unmatched });
        setTimeout(() => assetImportInputRef.current?.click(), 0);
        alert(`还有 ${resolved.unmatched.length} 张图片未找到，请继续选择图片所在文件夹或图片文件。`);
      } else {
        setPendingMarkdownImport(null);
      }
    } else if (imagePaths.length > 0) {
      setPendingMarkdownImport({ markdown, markdownFile, imagePaths });
      setTimeout(() => assetImportInputRef.current?.click(), 0);
      alert(`检测到 ${imagePaths.length} 张本地图片引用，请选择图片所在文件夹或图片文件。`);
    } else {
      setPendingMarkdownImport(null);
    }

    setFormContent(markdown);
    if (!formTitle.trim()) {
      setFormTitle(markdownFile.name.replace(/\.(md|markdown)$/i, ""));
    }
  };

  const importAssetsForPendingMarkdown = async (files: FileList | null) => {
    if (!files || files.length === 0 || !pendingMarkdownImport) return;
    const resolved = await resolveMarkdownAssets(
      pendingMarkdownImport.markdown,
      pendingMarkdownImport.markdownFile,
      pendingMarkdownImport.imagePaths,
      files,
    );
    setFormContent(resolved.markdown);
    if (resolved.unmatched.length > 0) {
      setPendingMarkdownImport({
        ...pendingMarkdownImport,
        markdown: resolved.markdown,
        imagePaths: resolved.unmatched,
      });
      alert(`仍有 ${resolved.unmatched.length} 张图片没有找到，路径已保留：\n${resolved.unmatched.join("\n")}`);
    } else {
      setPendingMarkdownImport(null);
    }
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
        const res = await fetch("/api/auth/login", {
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
          <p className="text-gray-500 text-center mb-8">登录以管理您的作品集和博客</p>
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
              登录
            </button>
          </form>
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
        <div className={activeTab === "blog" || activeTab === "docs" ? "max-w-[1600px] mx-auto" : "max-w-5xl mx-auto"}>
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
              onReorder={handleProjectReorder}
            />
          )}
          {activeTab === "blog" && (
            <BlogManager
              posts={apiPosts}
              onNew={() => setEditingContext({ type: "blog", item: null })}
              onEdit={(item) => setEditingContext({ type: "blog", item })}
              onDelete={(id) => handleDelete("blog", id)}
              onReorder={handlePostReorder}
              editorActive={editingContext?.type === "blog"}
              activePostId={editingContext?.type === "blog" && editingContext.item ? (editingContext.item as ApiPost).id : null}
              formTitle={formTitle}
              setFormTitle={setFormTitle}
              formSnippet={formSnippet}
              setFormSnippet={setFormSnippet}
              formDate={formDate}
              setFormDate={setFormDate}
              formReadTime={formReadTime}
              setFormReadTime={setFormReadTime}
              formContent={formContent}
              setFormContent={setFormContent}
              onSave={handleSave}
              saving={saving}
              canSave={!!editingContext && editingContext.type === "blog" && !!formTitle.trim()}
              importMarkdownOnly={importMarkdownOnly}
              importAssetsForPendingMarkdown={importAssetsForPendingMarkdown}
              uploadMarkdownAsset={uploadMarkdownAsset}
              assetImportInputRef={assetImportInputRef}
              pendingMarkdownImport={pendingMarkdownImport}
            />
          )}
          {activeTab === "docs" && (
            <DocsManager
              docs={apiDocs}
              onNewRoot={(isFolder) => setEditingContext({ type: "doc", item: null, parentId: null, isFolder })}
              onNewChild={(parentId, isFolder) => setEditingContext({ type: "doc", item: null, parentId, isFolder })}
              onEdit={(item) => setEditingContext({ type: "doc", item })}
              onDelete={(node) =>
                handleDelete("doc", node.id, "", true)
              }
              onMove={handleDocMove}
              editorActive={editingContext?.type === "doc" && !editingDocIsFolder}
              activeDocId={editingContext?.type === "doc" && editingContext.item ? (editingContext.item as DocNode).id : null}
              editingDocIsFolder={editingDocIsFolder}
              formTitle={formTitle}
              setFormTitle={setFormTitle}
              formContent={formContent}
              setFormContent={setFormContent}
              onSave={handleSave}
              saving={saving}
              canSave={!!editingContext && editingContext.type === "doc" && !editingDocIsFolder && !!formTitle.trim()}
              importMarkdownOnly={importMarkdownOnly}
              importAssetsForPendingMarkdown={importAssetsForPendingMarkdown}
              uploadMarkdownAsset={uploadMarkdownAsset}
              assetImportInputRef={assetImportInputRef}
              pendingMarkdownImport={pendingMarkdownImport}
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
        {editingContext && !(editingContext.type === "blog" || (editingContext.type === "doc" && !editingDocIsFolder)) && (
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    {editingContext.type === "experience" ? "公司 / 组织名称" : editingContext.type === "doc" && editingDocIsFolder ? "目录名称" : "项目标题"}
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    placeholder={
                      editingContext.type === "experience" ? "如：字节跳动 (ByteDance)"
                      : editingContext.type === "project" ? "如：企业级 SaaS 平台后台系统"
                      : "输入标题..."
                    }
                  />
                </div>

                {editingContext.type === "project" ? (
                  <>
                    {/* ── 封面图片（最顶部，视觉优先） ── */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">封面图片</label>
                      <div className="flex gap-3 items-start">
                        <input
                          type="text"
                          value={formImageUrl}
                          onChange={(e) => setFormImageUrl(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                          placeholder="图片 URL 或点击上传..."
                        />
                        <label className="h-12 px-4 border-2 border-dashed border-gray-200 rounded-xl flex items-center gap-2 text-gray-400 hover:text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer shrink-0">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const fd = new FormData();
                                fd.append("file", file);
                                try {
                                  const res = await fetch("/api/upload", { method: "POST", body: fd });
                                  const data = await res.json();
                                  if (data.url) setFormImageUrl(data.url);
                                } catch { alert("上传失败"); }
                              }
                            }}
                          />
                          <UploadCloud className="w-5 h-5" />
                          <span className="text-sm font-medium">上传</span>
                        </label>
                      </div>
                      {formImageUrl && (
                        <div className="mt-3 h-36 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                          <img src={formImageUrl} className="w-full h-full object-cover" alt="预览" />
                        </div>
                      )}
                    </div>

                    {/* ── 基础信息 ── */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">编号</label>
                        <input
                          type="text"
                          value={formNum}
                          onChange={(e) => setFormNum(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono"
                          placeholder="01"
                          maxLength={4}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">分类</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-white"
                        >
                          <option value="">-- 选择分类 --</option>
                          <option value="Backend">Backend</option>
                          <option value="Full Stack">Full Stack</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">副标题</label>
                      <input
                        type="text"
                        value={formSubtitle}
                        onChange={(e) => setFormSubtitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        placeholder="如：高可用多租户业务管理中台"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">卡片简介</label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-sm"
                        placeholder="一句话简介，显示在作品集卡片上..."
                      />
                    </div>

                    {/* ── 详情页元数据 ── */}
                    <div className="border-t border-gray-100 pt-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">详情页元数据</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">角色</label>
                          <input
                            type="text"
                            value={formRole}
                            onChange={(e) => setFormRole(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            placeholder="如：后端架构师"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">项目周期</label>
                          <input
                            type="text"
                            value={formPeriod}
                            onChange={(e) => setFormPeriod(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono"
                            placeholder="2025.03 — 2025.08"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── 项目概述 ── */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">项目概述</label>
                      <p className="text-xs text-gray-400 mb-2">对应详情页「项目概述」模块，支持空行分段</p>
                      <textarea
                        value={formOverview}
                        onChange={(e) => setFormOverview(e.target.value)}
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y text-sm"
                        placeholder="详细的项目背景、技术决策和结果..."
                      />
                    </div>

                    {/* ── 核心功能 ── */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">核心功能</label>
                          <p className="text-xs text-gray-400 mt-0.5">对应详情页「核心功能」列表，每条含标题、说明和文档链接</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormFeatureRows((rows) => [...rows, { title: "", detail: "", doc: "#" }])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" /> 添加功能点
                        </button>
                      </div>
                      <div className="space-y-2">
                        {formFeatureRows.length === 0 && (
                          <div className="py-6 text-center text-gray-300 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                            点击「添加功能点」开始填写
                          </div>
                        )}
                        {formFeatureRows.map((row, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => { dragIndexRef.current = idx; }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = dragIndexRef.current;
                              if (from === null || from === idx) return;
                              setFormFeatureRows((rows) => {
                                const next = [...rows];
                                const [moved] = next.splice(from, 1);
                                next.splice(idx, 0, moved);
                                return next;
                              });
                              dragIndexRef.current = null;
                              setDragOverIndex(null);
                            }}
                            onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                            style={{
                              opacity: dragIndexRef.current === idx ? 0.4 : 1,
                              borderColor: dragOverIndex === idx && dragIndexRef.current !== idx ? "#818cf8" : undefined,
                            }}
                            className="flex gap-2 items-start bg-gray-50 rounded-xl p-3 border border-gray-100 transition-colors"
                          >
                            {/* drag handle */}
                            <div
                              className="mt-2.5 shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 transition-colors"
                              title="拖动排序"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <div className="flex-1 grid grid-cols-1 gap-2">
                              {/* title */}
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) => {
                                  const next = [...formFeatureRows];
                                  next[idx] = { ...next[idx], title: e.target.value };
                                  setFormFeatureRows(next);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                placeholder="功能标题，如：多租户数据隔离设计"
                              />
                              {/* detail */}
                              <input
                                type="text"
                                value={row.detail}
                                onChange={(e) => {
                                  const next = [...formFeatureRows];
                                  next[idx] = { ...next[idx], detail: e.target.value };
                                  setFormFeatureRows(next);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-gray-500"
                                placeholder="一行说明，如：基于 Schema 隔离，防止越权访问"
                              />
                              {/* feature doc link — optional */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-gray-300 whitespace-nowrap shrink-0">
                                  文档↗
                                </span>
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={row.doc === "#" ? "" : row.doc}
                                    onChange={(e) => {
                                      const next = [...formFeatureRows];
                                      next[idx] = { ...next[idx], doc: e.target.value || "#" };
                                      setFormFeatureRows(next);
                                    }}
                                    className="w-full px-3 py-2 pr-14 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-mono text-gray-400"
                                    placeholder="该功能点的实现文档链接（可选）"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-300 pointer-events-none">
                                    可选
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setFormFeatureRows((rows) => rows.filter((_, i) => i !== idx))}
                              className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors mt-1 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── 详情介绍 ── */}
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">详情介绍</label>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {projectDetailPasteUploadCount > 0
                              ? `正在上传 ${projectDetailPasteUploadCount} 张图片`
                              : "对应详情页「核心功能」下方的 Markdown 内容，支持标题、列表、代码块、表格和图片"}
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-bold cursor-pointer shrink-0">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                              await importProjectDetailImages(e.target.files);
                              e.currentTarget.value = "";
                            }}
                          />
                          <UploadCloud className="w-3.5 h-3.5" />
                          导入图片
                        </label>
                      </div>
                      <textarea
                        ref={formDetailRef}
                        value={formDetail}
                        onChange={(e) => setFormDetail(e.target.value)}
                        onPaste={handleProjectDetailPasteImages}
                        rows={10}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y text-sm font-mono leading-7"
                        placeholder={"## 技术实现\n\n- 关键设计点\n- 复杂问题与解决方案\n\n```ts\n// code\n```"}
                      />
                    </div>

                    {/* ── 标签与技术栈 ── */}
                    <div className="border-t border-gray-100 pt-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">标签与技术栈</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">图片标签（逗号分隔）</label>
                          <p className="text-xs text-gray-400 mb-1.5">显示在卡片图片上，建议 3 个以内</p>
                          <input
                            type="text"
                            value={formTags}
                            onChange={(e) => setFormTags(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            placeholder="Node.js, Redis, PostgreSQL"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">技术栈（逗号分隔）</label>
                          <p className="text-xs text-gray-400 mb-1.5">显示在详情页元数据栏</p>
                          <input
                            type="text"
                            value={formStack}
                            onChange={(e) => setFormStack(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            placeholder="Node.js, Express, PostgreSQL, Redis, Docker"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── 外部链接 ── */}
                    <div className="border-t border-gray-100 pt-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">外部链接（可选）</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">在线访问</label>
                          <input
                            type="text"
                            value={formLink}
                            onChange={(e) => setFormLink(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">源码仓库</label>
                          <input
                            type="text"
                            value={formGithub}
                            onChange={(e) => setFormGithub(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            placeholder="https://github.com/..."
                          />
                        </div>
                      </div>
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
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="block text-sm font-medium text-gray-700">Markdown 正文内容</label>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors">
                          <input
                            type="file"
                            className="hidden"
                            accept=".md,.markdown"
                            onChange={async (e) => {
                              try {
                                await importMarkdownOnly(e.target.files);
                              } catch (error) {
                                alert(error instanceof Error ? error.message : "导入失败");
                              } finally {
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <UploadCloud className="w-4 h-4" />
                          导入 Markdown
                        </label>
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors">
                          <input
                            ref={assetImportInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                            onChange={async (e) => {
                              try {
                                await importAssetsForPendingMarkdown(e.target.files);
                              } catch (error) {
                                alert(error instanceof Error ? error.message : "导入失败");
                              } finally {
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <Folder className="w-4 h-4" />
                          选择图片位置
                        </label>
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors">
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*"
                            onChange={async (e) => {
                              try {
                                await importAssetsForPendingMarkdown(e.target.files);
                              } catch (error) {
                                alert(error instanceof Error ? error.message : "导入失败");
                              } finally {
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <UploadCloud className="w-4 h-4" />
                          选择图片文件
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      先导入 .md 文件；如果检测到本地图片引用，会提示选择图片所在文件夹并自动替换为 /uploads 地址。
                    </p>
                    {pendingMarkdownImport && (
                      <p className="text-xs text-amber-600 mb-2">
                        还有 {pendingMarkdownImport.imagePaths.length} 张图片等待匹配，请点击“选择图片位置”。
                      </p>
                    )}
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
  onReorder,
}: {
  projects: ApiProject[];
  onNew: () => void;
  onEdit: (item: ApiProject) => void;
  onDelete: (id: number) => void;
  onReorder: (ids: Array<number | string>) => void;
}) {
  const dragIdRef = useRef<number | null>(null);

  const handleDrop = (targetId: number) => {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    onReorder(reorderIds(projects, draggedId, targetId));
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => { dragIdRef.current = p.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(p.id)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
            >
              <div className="relative h-40 bg-gray-100 shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Layers className="w-8 h-8 text-gray-200" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {p.num && (
                  <span className="absolute top-3 right-3 font-mono text-xs font-bold text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    {p.num}
                  </span>
                )}
                {p.category && (
                  <span className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    {p.category}
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div>
                  <h3 className="font-bold text-base text-gray-900 leading-snug">{p.title}</h3>
                  {p.subtitle && <p className="text-indigo-500 text-xs font-medium mt-0.5">{p.subtitle}</p>}
                  {p.period && <p className="text-gray-400 text-xs font-mono mt-0.5">{p.period}</p>}
                  {p.description && <p className="text-gray-500 text-sm mt-2 line-clamp-2">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-50">
                  <span className="flex items-center justify-center p-2 text-gray-300" title="拖拽排序">
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <button onClick={() => onEdit(p)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 font-medium rounded-lg transition-colors text-sm">
                    <Edit3 className="w-4 h-4" /> 编辑
                  </button>
                  <button onClick={() => onDelete(p.id)} className="flex items-center justify-center p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
  onReorder,
  editorActive,
  activePostId,
  formTitle,
  setFormTitle,
  formSnippet,
  setFormSnippet,
  formDate,
  setFormDate,
  formReadTime,
  setFormReadTime,
  formContent,
  setFormContent,
  onSave,
  saving,
  canSave,
  importMarkdownOnly,
  importAssetsForPendingMarkdown,
  uploadMarkdownAsset,
  assetImportInputRef,
  pendingMarkdownImport,
}: {
  posts: ApiPost[];
  onNew: () => void;
  onEdit: (item: ApiPost) => void;
  onDelete: (id: number) => void;
  onReorder: (ids: Array<number | string>) => void;
  editorActive: boolean;
  activePostId: number | null;
  formTitle: string;
  setFormTitle: (value: string) => void;
  formSnippet: string;
  setFormSnippet: (value: string) => void;
  formDate: string;
  setFormDate: (value: string) => void;
  formReadTime: string;
  setFormReadTime: (value: string) => void;
  formContent: string;
  setFormContent: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  importMarkdownOnly: (files: FileList | null) => Promise<void>;
  importAssetsForPendingMarkdown: (files: FileList | null) => Promise<void>;
  uploadMarkdownAsset: UploadMarkdownAsset;
  assetImportInputRef: React.MutableRefObject<HTMLInputElement | null>;
  pendingMarkdownImport: { markdown: string; markdownFile: File; imagePaths: string[] } | null;
}) {
  const dragIdRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const filteredPosts = posts.filter((post) => {
    const text = `${post.title} ${post.snippet ?? ""} ${post.date ?? ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const handleDrop = (targetId: number) => {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    onReorder(reorderIds(posts, draggedId, targetId));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-4rem)]">
      <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f4fbfb] shadow-sm">
        <div className="grid h-full grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white/80">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h1 className="text-base font-bold text-slate-900">博客文章</h1>
                <p className="text-xs text-slate-400">{posts.length} 篇文章</p>
              </div>
              <button onClick={onNew} title="写新文章" className="rounded-lg bg-teal-500 p-2 text-white transition-colors hover:bg-teal-600">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-400">
                <Search className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="搜索标题、摘要..."
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 custom-scrollbar">
              {filteredPosts.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-400">暂无匹配文章</div>
              ) : (
                filteredPosts.map((p) => {
                  const active = activePostId === p.id;
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => { dragIdRef.current = p.id; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(p.id)}
                      className={`group mb-1 flex cursor-grab items-start gap-2 rounded-xl px-3 py-3 transition-colors active:cursor-grabbing ${
                        active ? "bg-teal-50 text-teal-700 ring-1 ring-teal-100" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                      <button onClick={() => onEdit(p)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <FileText className={`h-4 w-4 shrink-0 ${active ? "text-teal-500" : "text-slate-400"}`} />
                          <span className="block truncate text-sm font-semibold">{p.title}</span>
                        </div>
                        <div className="mt-1 truncate pl-6 text-xs text-slate-400">
                          {[p.date, p.readTime].filter(Boolean).join(" / ") || "未设置元信息"}
                        </div>
                      </button>
                      <button onClick={() => onDelete(p.id)} title="删除" className="rounded-md p-1.5 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <MarkdownWorkspaceEditor
            kind="blog"
            active={editorActive}
            title={formTitle}
            setTitle={setFormTitle}
            content={formContent}
            setContent={setFormContent}
            snippet={formSnippet}
            setSnippet={setFormSnippet}
            date={formDate}
            setDate={setFormDate}
            readTime={formReadTime}
            setReadTime={setFormReadTime}
            onSave={onSave}
            saving={saving}
            canSave={canSave}
            importMarkdownOnly={importMarkdownOnly}
            importAssetsForPendingMarkdown={importAssetsForPendingMarkdown}
            uploadMarkdownAsset={uploadMarkdownAsset}
            assetImportInputRef={assetImportInputRef}
            pendingMarkdownImport={pendingMarkdownImport}
          />
        </div>
      </div>
    </motion.div>
  );
}

function MarkdownWorkspaceEditor({
  kind,
  active,
  title,
  setTitle,
  content,
  setContent,
  snippet,
  setSnippet,
  date,
  setDate,
  readTime,
  setReadTime,
  breadcrumb,
  onSave,
  saving,
  canSave,
  importMarkdownOnly,
  importAssetsForPendingMarkdown,
  uploadMarkdownAsset,
  assetImportInputRef,
  pendingMarkdownImport,
}: {
  kind: "blog" | "doc";
  active: boolean;
  title: string;
  setTitle: (value: string) => void;
  content: string;
  setContent: (value: string) => void;
  snippet?: string;
  setSnippet?: (value: string) => void;
  date?: string;
  setDate?: (value: string) => void;
  readTime?: string;
  setReadTime?: (value: string) => void;
  breadcrumb?: string;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  importMarkdownOnly: (files: FileList | null) => Promise<void>;
  importAssetsForPendingMarkdown: (files: FileList | null) => Promise<void>;
  uploadMarkdownAsset: UploadMarkdownAsset;
  assetImportInputRef: React.MutableRefObject<HTMLInputElement | null>;
  pendingMarkdownImport: { markdown: string; markdownFile: File; imagePaths: string[] } | null;
}) {
  if (!active) {
    return (
      <section className="flex h-full items-center justify-center bg-[#f4fbfb] p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-500 shadow-sm ring-1 ring-slate-100">
            {kind === "blog" ? <FileText className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
          </div>
          <h2 className="text-lg font-bold text-slate-800">{kind === "blog" ? "选择或新建一篇博客" : "选择或新建一篇面经文档"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">左侧负责组织内容，右侧会像 Obsidian 一样同步编辑 Markdown 并实时预览。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col bg-[#f4fbfb]">
      <header className="border-b border-slate-200 bg-white/70 px-5 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span className="truncate">{breadcrumb || (kind === "blog" ? "博客 / 文章" : "面经 / 文档")}</span>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold tracking-normal text-slate-900 outline-none placeholder:text-slate-300"
              placeholder={kind === "blog" ? "未命名博客" : "未命名文档"}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MarkdownImportControls
              importMarkdownOnly={importMarkdownOnly}
              importAssetsForPendingMarkdown={importAssetsForPendingMarkdown}
              assetImportInputRef={assetImportInputRef}
            />
            <button
              onClick={onSave}
              disabled={saving || !canSave}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存发布
            </button>
          </div>
        </div>

        {kind === "blog" && (
          <div className="grid grid-cols-[150px_150px_minmax(0,1fr)] gap-3">
            <input
              value={date ?? ""}
              onChange={(e) => setDate?.(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none transition-colors focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              placeholder="日期"
            />
            <input
              value={readTime ?? ""}
              onChange={(e) => setReadTime?.(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none transition-colors focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              placeholder="阅读时间"
            />
            <input
              value={snippet ?? ""}
              onChange={(e) => setSnippet?.(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none transition-colors focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              placeholder="文章摘要"
            />
          </div>
        )}

        {pendingMarkdownImport && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            还有 {pendingMarkdownImport.imagePaths.length} 张图片等待匹配，请点击“选择图片位置”。
          </div>
        )}
      </header>

      <LiveMarkdownEditor content={content} setContent={setContent} uploadMarkdownAsset={uploadMarkdownAsset} />
    </section>
  );
}

function getClipboardImageFiles(clipboardData: DataTransfer) {
  const directFiles = Array.from(clipboardData.files).filter((file) => file.type.startsWith("image/"));
  if (directFiles.length > 0) return directFiles;

  return Array.from(clipboardData.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function getImageAltText(file: File, index: number) {
  if (!file.name) return `clipboard-image-${index + 1}`;
  return file.name.replace(/\.[^.]+$/, "") || `clipboard-image-${index + 1}`;
}

function LiveMarkdownEditor({
  content,
  setContent,
  uploadMarkdownAsset,
}: {
  content: string;
  setContent: (value: string) => void;
  uploadMarkdownAsset: UploadMarkdownAsset;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef(content);
  const pendingModeSwitchScrollTopRef = useRef<number | null>(null);
  const [isSourceEditing, setIsSourceEditing] = useState(false);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [pasteUploadCount, setPasteUploadCount] = useState(0);
  const headings = useMemo(() => extractMarkdownHeadings(content, [1, 2, 3, 4]), [content]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useLayoutEffect(() => {
    if (!isSourceEditing) return;
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 620)}px`;
  }, [content, isSourceEditing]);

  useLayoutEffect(() => {
    const pendingScrollTop = pendingModeSwitchScrollTopRef.current;
    const container = scrollContainerRef.current;
    if (pendingScrollTop === null || !container) return;

    container.scrollTop = pendingScrollTop;
    pendingModeSwitchScrollTopRef.current = null;
  }, [isSourceEditing]);

  const scrollToHeading = (id: string) => {
    const container = scrollContainerRef.current;
    const target = container?.querySelector(`#${CSS.escape(id)}`);
    if (!container || !(target instanceof HTMLElement)) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + targetRect.top - containerRect.top - 32,
      behavior: "smooth",
    });
  };

  const updateContent = (nextContent: string) => {
    contentRef.current = nextContent;
    setContent(nextContent);
  };

  const switchEditorMode = (nextIsSourceEditing: boolean) => {
    if (nextIsSourceEditing === isSourceEditing) return;
    pendingModeSwitchScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    setIsSourceEditing(nextIsSourceEditing);
  };

  const insertAtSelection = (textarea: HTMLTextAreaElement, markdown: string) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = contentRef.current;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n\n";
    const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n\n";
    const next = `${before}${prefix}${markdown}${suffix}${after}`;
    const cursor = before.length + prefix.length + markdown.length;
    updateContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, 620)}px`;
    });
  };

  const replaceFirstMarkdown = (search: string, replacement: string) => {
    const current = contentRef.current;
    const index = current.indexOf(search);
    if (index === -1) return;
    updateContent(`${current.slice(0, index)}${replacement}${current.slice(index + search.length)}`);
  };

  const handlePasteImages = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = getClipboardImageFiles(event.clipboardData);
    if (images.length === 0) return;

    event.preventDefault();
    const placeholders = images.map((_, index) => `![图片上传中 ${index + 1}](uploading://clipboard-image-${Date.now()}-${index})`);
    insertAtSelection(event.currentTarget, placeholders.join("\n\n"));
    setPasteUploadCount((count) => count + images.length);

    await Promise.all(
      images.map(async (file, index) => {
        const placeholder = placeholders[index];
        try {
          const url = await uploadMarkdownAsset(file);
          replaceFirstMarkdown(placeholder, `![${getImageAltText(file, index)}](${url})`);
        } catch (error) {
          replaceFirstMarkdown(placeholder, `<!-- 图片上传失败：${file.name || `clipboard-image-${index + 1}`} -->`);
          alert(error instanceof Error ? error.message : "图片上传失败");
        } finally {
          setPasteUploadCount((count) => Math.max(0, count - 1));
        }
      }),
    );
  };

  return (
    <div className="grid min-h-0 flex-1 bg-[#f4fbfb]" style={{ gridTemplateColumns: tocCollapsed ? "minmax(0,1fr) 48px" : "minmax(0,1fr) 260px" }}>
      <div ref={scrollContainerRef} className="min-h-0 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-4xl px-8 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm">
            <div className="sticky top-0 z-20 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white/95 px-8 py-4 text-xs font-bold uppercase tracking-wide text-slate-400 shadow-sm backdrop-blur">
              <span>{pasteUploadCount > 0 ? `正在上传 ${pasteUploadCount} 张图片` : isSourceEditing ? "Markdown Source" : "Rendered Preview"}</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => switchEditorMode(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    !isSourceEditing ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  预览
                </button>
                <button
                  type="button"
                  onClick={() => switchEditorMode(true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    isSourceEditing ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  源码
                </button>
              </div>
            </div>
            <div className="px-8 py-7">
              {isSourceEditing ? (
                <textarea
                  ref={sourceTextareaRef}
                  value={content}
                  onChange={(event) => {
                    updateContent(event.target.value);
                    event.currentTarget.style.height = "auto";
                    event.currentTarget.style.height = `${Math.max(event.currentTarget.scrollHeight, 620)}px`;
                  }}
                  onPaste={handlePasteImages}
                  className="min-h-[620px] w-full resize-none overflow-hidden bg-transparent p-0 font-mono text-[15px] leading-8 text-slate-800 outline-none placeholder:text-slate-400 selection:bg-teal-100"
                  placeholder="输入 Markdown..."
                  spellCheck={false}
                />
              ) : (
                <MarkdownRenderer
                  content={content || "> 开始编写内容..."}
                  className="admin-markdown-preview min-h-[620px]"
                  editableTables={{
                    onAddColumn: (tableIndex) => setContent(addMarkdownTableColumn(content, tableIndex)),
                    onAddRow: (tableIndex) => setContent(addMarkdownTableRow(content, tableIndex)),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <AdminHeadingToc
        headings={headings}
        collapsed={tocCollapsed}
        onToggle={() => setTocCollapsed((value) => !value)}
        onSelect={scrollToHeading}
      />
    </div>
  );
}

function AdminHeadingToc({
  headings,
  collapsed,
  onToggle,
  onSelect,
}: {
  headings: ReturnType<typeof extractMarkdownHeadings>;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="min-h-0 border-l border-slate-200 bg-white/70">
      <button
        onClick={onToggle}
        className="flex h-12 w-full items-center justify-center border-b border-slate-100 text-xs font-bold text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
        title={collapsed ? "展开标题树" : "收起标题树"}
      >
        {collapsed ? "»" : "«"}
      </button>
      {!collapsed && (
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-3 custom-scrollbar">
          {headings.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">暂无标题</p>
          ) : (
            <div className="space-y-1">
              {headings.map((heading) => (
                <button
                  key={`${heading.id}-${heading.line}`}
                  onClick={() => onSelect(heading.id)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-xs leading-5 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700"
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                >
                  <span className={heading.level <= 2 ? "font-semibold text-slate-700" : ""}>{heading.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

type MarkdownTableRange = {
  start: number;
  end: number;
};

function findMarkdownTables(markdown: string): MarkdownTableRange[] {
  const lines = markdown.split(/\r?\n/);
  const tables: MarkdownTableRange[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^\s*```/.test(lines[index])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!isMarkdownTableRow(lines[index]) || !isMarkdownTableSeparator(lines[index + 1])) continue;

    const start = index;
    index += 2;
    while (index < lines.length && isMarkdownTableRow(lines[index])) {
      index += 1;
    }
    const end = index - 1;
    tables.push({ start, end });
    index = end;
  }

  return tables;
}

function isMarkdownTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.includes("|") && !/^```/.test(trimmed);
}

function isMarkdownTableSeparator(line: string) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function normalizeTableCells(cells: string[], count: number) {
  return Array.from({ length: count }, (_, index) => cells[index] ?? "");
}

function formatMarkdownTableRow(cells: string[]) {
  return `| ${cells.join(" | ")} |`;
}

function addMarkdownTableColumn(markdown: string, tableIndex: number) {
  const lines = markdown.split(/\r?\n/);
  const table = findMarkdownTables(markdown)[tableIndex];
  if (!table) return markdown;

  for (let index = table.start; index <= table.end; index += 1) {
    const cells = splitMarkdownTableRow(lines[index]);
    lines[index] = isMarkdownTableSeparator(lines[index])
      ? formatMarkdownTableRow([...cells, "---"])
      : formatMarkdownTableRow([...cells, ""]);
  }

  return lines.join("\n");
}

function addMarkdownTableRow(markdown: string, tableIndex: number) {
  const lines = markdown.split(/\r?\n/);
  const table = findMarkdownTables(markdown)[tableIndex];
  if (!table) return markdown;

  const columnCount = Math.max(
    ...lines.slice(table.start, table.end + 1).map((line) => splitMarkdownTableRow(line).length),
    1,
  );
  lines.splice(table.end + 1, 0, formatMarkdownTableRow(normalizeTableCells([], columnCount)));

  return lines.join("\n");
}

function MarkdownImportControls({
  importMarkdownOnly,
  importAssetsForPendingMarkdown,
  assetImportInputRef,
}: {
  importMarkdownOnly: (files: FileList | null) => Promise<void>;
  importAssetsForPendingMarkdown: (files: FileList | null) => Promise<void>;
  assetImportInputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-center gap-1">
      <label title="导入 Markdown" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-600">
        <input
          type="file"
          className="hidden"
          accept=".md,.markdown"
          onChange={async (e) => {
            try {
              await importMarkdownOnly(e.target.files);
            } catch (error) {
              alert(error instanceof Error ? error.message : "导入失败");
            } finally {
              e.currentTarget.value = "";
            }
          }}
        />
        <UploadCloud className="h-4 w-4" />
        导入
      </label>
      <label title="选择图片所在文件夹" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-600">
        <input
          ref={assetImportInputRef}
          type="file"
          className="hidden"
          multiple
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={async (e) => {
            try {
              await importAssetsForPendingMarkdown(e.target.files);
            } catch (error) {
              alert(error instanceof Error ? error.message : "导入失败");
            } finally {
              e.currentTarget.value = "";
            }
          }}
        />
        <Folder className="h-4 w-4" />
        图片位置
      </label>
    </div>
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
  onMove,
  editorActive,
  activeDocId,
  editingDocIsFolder,
  formTitle,
  setFormTitle,
  formContent,
  setFormContent,
  onSave,
  saving,
  canSave,
  importMarkdownOnly,
  importAssetsForPendingMarkdown,
  uploadMarkdownAsset,
  assetImportInputRef,
  pendingMarkdownImport,
}: {
  docs: DocNode[];
  onNewRoot: (isFolder: boolean) => void;
  onNewChild: (parentId: string, isFolder: boolean) => void;
  onEdit: (node: DocNode) => void;
  onDelete: (node: DocNode) => void;
  onMove: (payload: { movedId: string; newParentId: string | null; oldSiblingIds: string[]; newSiblingIds: string[] }) => void;
  editorActive: boolean;
  activeDocId: string | null;
  editingDocIsFolder: boolean;
  formTitle: string;
  setFormTitle: (value: string) => void;
  formContent: string;
  setFormContent: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  importMarkdownOnly: (files: FileList | null) => Promise<void>;
  importAssetsForPendingMarkdown: (files: FileList | null) => Promise<void>;
  uploadMarkdownAsset: UploadMarkdownAsset;
  assetImportInputRef: React.MutableRefObject<HTMLInputElement | null>;
  pendingMarkdownImport: { markdown: string; markdownFile: File; imagePaths: string[] } | null;
}) {
  const dragIdRef = useRef<string | null>(null);
  const [dropHint, setDropHint] = useState<{ targetId: string; position: DocDropPosition } | null>(null);
  const [query, setQuery] = useState("");
  const flattenedDocs = flattenDocs(docs);
  const activeTrail = flattenedDocs.find(({ node }) => node.id === activeDocId)?.trail ?? [];
  const visibleDocs = query.trim()
    ? flattenedDocs.filter(({ node, trail }) => `${trail.join(" ")} ${node.content ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const handleDrop = (targetNode: DocNode, targetParentId: string | null, targetSiblings: DocNode[], position: DocDropPosition) => {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    setDropHint(null);
    if (!draggedId || draggedId === targetNode.id) return;

    const draggedInfo = findDocParentInfo(docs, draggedId);
    if (!draggedInfo) return;
    if (draggedInfo.node.isFolder && isDocDescendant(draggedInfo.node, targetNode.id)) return;

    const oldSiblingIds = withoutDocId(draggedInfo.siblings, draggedId).map((node) => node.id);
    if (position === "inside") {
      if (!targetNode.isFolder) return;
      const existingChildren = withoutDocId(targetNode.children ?? [], draggedId).map((node) => node.id);
      onMove({
        movedId: draggedId,
        newParentId: targetNode.id,
        oldSiblingIds,
        newSiblingIds: [...existingChildren, draggedId],
      });
      return;
    }

    const targetSiblingIds = insertDocId(targetSiblings.map((node) => node.id), draggedId, targetNode.id, position);
    onMove({
      movedId: draggedId,
      newParentId: targetParentId,
      oldSiblingIds,
      newSiblingIds: targetSiblingIds,
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-4rem)]">
      <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f4fbfb] shadow-sm">
        <div className="grid h-full grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white/80">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">面经文档库</h1>
                  <p className="text-xs text-slate-400">{countDocs(docs)} 篇文档</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onNewRoot(true)} title="新建顶级目录" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-600">
                    <FolderPlus className="h-4 w-4" />
                  </button>
                  <button onClick={() => onNewRoot(false)} title="新建顶级文档" className="rounded-lg bg-teal-500 p-2 text-white transition-colors hover:bg-teal-600">
                    <FilePlus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-400">
                <Search className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="搜索目录、文档..."
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
              {docs.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-400">暂无面经内容</div>
              ) : query.trim() ? (
                <div className="space-y-1">
                  {visibleDocs.map(({ node, trail }) => (
                    <button
                      key={node.id}
                      onClick={() => onEdit(node)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        activeDocId === node.id ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {node.isFolder ? <Folder className="h-4 w-4 shrink-0 text-teal-500" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" />}
                      <span className="min-w-0 flex-1 truncate">{trail.join(" / ")}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {docs.map((node) => (
                    <DocTreeNode
                      key={node.id}
                      node={node}
                      siblings={docs}
                      parentId={null}
                      level={0}
                      activeDocId={activeDocId}
                      dragIdRef={dragIdRef}
                      dropHint={dropHint}
                      setDropHint={setDropHint}
                      onDropNode={handleDrop}
                      onNewChild={onNewChild}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <MarkdownWorkspaceEditor
            kind="doc"
            active={editorActive}
            title={formTitle}
            setTitle={setFormTitle}
            content={formContent}
            setContent={setFormContent}
            breadcrumb={activeTrail.join(" / ")}
            onSave={onSave}
            saving={saving}
            canSave={canSave}
            importMarkdownOnly={importMarkdownOnly}
            importAssetsForPendingMarkdown={importAssetsForPendingMarkdown}
            uploadMarkdownAsset={uploadMarkdownAsset}
            assetImportInputRef={assetImportInputRef}
            pendingMarkdownImport={pendingMarkdownImport}
          />
        </div>
      </div>
    </motion.div>
  );
}

function DocTreeNode({
  node,
  siblings,
  parentId,
  level,
  activeDocId,
  dragIdRef,
  dropHint,
  setDropHint,
  onDropNode,
  onNewChild,
  onEdit,
  onDelete,
}: {
  node: DocNode;
  siblings: DocNode[];
  parentId: string | null;
  level: number;
  activeDocId: string | null;
  dragIdRef: React.MutableRefObject<string | null>;
  dropHint: { targetId: string; position: DocDropPosition } | null;
  setDropHint: (hint: { targetId: string; position: DocDropPosition } | null) => void;
  onDropNode: (targetNode: DocNode, targetParentId: string | null, targetSiblings: DocNode[], position: DocDropPosition) => void;
  onNewChild: (parentId: string, isFolder: boolean) => void;
  onEdit: (node: DocNode) => void;
  onDelete: (node: DocNode) => void;
}) {
  const [open, setOpen] = useState(level === 0);
  const [confirming, setConfirming] = useState(false);
  const activeDrop = dropHint?.targetId === node.id ? dropHint.position : null;
  const selected = activeDocId === node.id;

  const getDropPosition = (e: React.DragEvent<HTMLDivElement>): DocDropPosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (node.isFolder && ratio > 0.25 && ratio < 0.75) return "inside";
    return ratio < 0.5 ? "before" : "after";
  };

  return (
    <div className="relative">
      {activeDrop === "before" && <div className="absolute left-2 right-2 top-0 h-0.5 rounded-full bg-indigo-500" />}
      <div
        draggable
        onDragStart={() => { dragIdRef.current = node.id; }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const draggedId = dragIdRef.current;
          if (!draggedId || draggedId === node.id) return;
          const position = getDropPosition(e);
          setDropHint({ targetId: node.id, position });
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropNode(node, parentId, siblings, activeDrop ?? getDropPosition(e));
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dropHint?.targetId === node.id) setDropHint(null);
        }}
        onDragEnd={() => {
          dragIdRef.current = null;
          setDropHint(null);
        }}
        className={`group flex items-center gap-2 py-2 px-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
          activeDrop === "inside"
            ? "bg-teal-50 ring-2 ring-teal-200"
            : selected
            ? "bg-teal-50 text-teal-700 ring-1 ring-teal-100"
            : "hover:bg-slate-50"
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
        {node.isFolder ? (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
            <Folder className="w-4 h-4 text-teal-600 shrink-0" />
            <span className={`text-sm font-medium truncate ${selected ? "text-teal-700" : "text-slate-700"}`}>{node.title}</span>
          </button>
        ) : (
          <button onClick={() => onEdit(node)} className="flex items-center gap-2 flex-1 min-w-0 text-left pl-6">
            <FileText className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-teal-500" : "text-gray-400"}`} />
            <span className={`text-sm truncate ${selected ? "font-semibold text-teal-700" : "text-gray-600"}`}>{node.title}</span>
          </button>
        )}

        {/* 操作按钮（hover 显示） */}
        {confirming ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500">确认删除?</span>
            <button
              onClick={() => { setConfirming(false); onDelete(node); }}
              className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              删除
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
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
            <button onClick={() => setConfirming(true)} title="删除" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {activeDrop === "after" && <div className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-indigo-500" />}

      {node.isFolder && open && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <DocTreeNode
              key={child.id}
              node={child}
              siblings={node.children ?? []}
              parentId={node.id}
              level={level + 1}
              activeDocId={activeDocId}
              dragIdRef={dragIdRef}
              dropHint={dropHint}
              setDropHint={setDropHint}
              onDropNode={onDropNode}
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
