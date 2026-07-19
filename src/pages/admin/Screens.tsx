import { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, BookOpen, Briefcase, Building2, Calendar, CheckCircle2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock, Eye, FileText, GripVertical, Layers, ListTree, Loader2, Plus, Save, Tag, Trash2, UploadCloud } from "lucide-react";
import type { DocNode, Project } from "../../data";
import { buildMarkdownHeadingTree, extractMarkdownHeadings, flattenVisibleMarkdownHeadingTree, getMarkdownHeadingKey, type MarkdownHeading } from "../../lib/markdown";
import { LiveMarkdownEditor } from "./LiveMarkdownEditor";
import { DocsTree } from "./DocsTree";
import { commaList, getMarkdownTitleFromFileName, safeParseArray } from "./fileHelpers";
import type { AdminTab, ApiExperience, ApiPost, ApiProject, UploadMarkdownAsset } from "./types";

export function countDocs(nodes: DocNode[]): number {
  return nodes.reduce((count, node) => count + (node.isFolder ? countDocs(node.children ?? []) : 1), 0);
}

export function firstLeaf(nodes: DocNode[]): DocNode | null {
  for (const node of nodes) {
    if (!node.isFolder) return node;
    const child = firstLeaf(node.children ?? []);
    if (child) return child;
  }
  return null;
}

function findDoc(nodes: DocNode[], id: string): DocNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findDoc(node.children ?? [], id);
    if (child) return child;
  }
  return null;
}

function findEditableDoc(nodes: DocNode[], id: string | null): DocNode | null {
  if (!id) return null;
  const node = findDoc(nodes, id);
  if (!node) return null;
  return node.isFolder ? firstLeaf(node.children ?? []) : node;
}

export function OverviewScreen({
  projects,
  posts,
  docs,
  experiences,
  onTabChange,
}: {
  projects: ApiProject[];
  posts: ApiPost[];
  docs: DocNode[];
  experiences: ApiExperience[];
  onTabChange: (tab: AdminTab) => void;
}) {
  const flatDocs = useMemo(() => flattenDocs(docs), [docs]);
  const recent = [
    ...posts.map((post) => ({ kind: "博客", title: post.title, time: post.date || "未设置日期" })),
    ...flatDocs.filter((doc) => !doc.node.isFolder).map(({ node, trail }) => ({ kind: trail.slice(0, -1).pop() || "面经", title: node.title, time: "面经文档" })),
  ].slice(0, 6);
  const stats = [
    { icon: Briefcase, label: "项目", value: projects.length, tab: "projects" as const, color: "var(--gray-700)" },
    { icon: FileText, label: "博客文章", value: posts.length, tab: "blog" as const, color: "var(--signal-indigo-600)" },
    { icon: BookOpen, label: "面经文档", value: countDocs(docs), tab: "docs" as const, color: "var(--seal)" },
    { icon: Layers, label: "经历", value: experiences.length, tab: "experience" as const, color: "var(--gray-700)" },
  ];
  return (
    <div className="w-full p-[28px_40px]">
      <h1 className="mb-1 font-display text-2xl font-extrabold text-gray-900">概览</h1>
      <p className="mb-6 text-sm text-gray-500">内容管理后台 · 几许</p>
      <div className="mb-8 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.tab} type="button" onClick={() => onTabChange(stat.tab)} className="rounded-2xl border border-gray-100 bg-white p-[18px_20px] text-left transition-colors hover:bg-gray-50">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${stat.color}1a`, color: stat.color }}><Icon className="h-3.5 w-3.5" /></span>
                <span className="text-[12.5px] font-semibold text-gray-500">{stat.label}</span>
              </div>
              <div className="font-display text-[28px] font-extrabold text-gray-900">{stat.value}</div>
            </button>
          );
        })}
      </div>
      <div className="mb-2.5 font-mono text-[12.5px] font-bold uppercase tracking-wider text-gray-400">最近更新</div>
      <div className="max-w-[760px] overflow-hidden rounded-[14px] border border-gray-100 bg-white">
        {recent.length === 0 ? <div className="px-4 py-8 text-sm text-gray-400">暂无内容</div> : recent.map((item, index) => (
          <div key={`${item.kind}-${item.title}-${index}`} className={`flex items-center justify-between gap-3 px-4 py-3 ${index < recent.length - 1 ? "border-b border-gray-100" : ""}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="rounded-full bg-gray-50 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-400">{item.kind}</span>
              <span className="truncate text-sm font-semibold text-gray-800">{item.title}</span>
            </div>
            <span className="shrink-0 font-mono text-xs text-gray-400">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsScreen({
  projects,
  token,
  uploadMarkdownAsset,
  onRefresh,
}: {
  projects: ApiProject[];
  token: string;
  uploadMarkdownAsset: UploadMarkdownAsset;
  onRefresh: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<number | null>(projects[0]?.id ?? null);
  const active = projects.find((project) => project.id === activeId) ?? projects[0] ?? null;
  const [form, setForm] = useState(() => projectToForm(active));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projects.length && !projects.some((project) => project.id === activeId)) setActiveId(projects[0].id);
  }, [projects, activeId]);
  useEffect(() => setForm(projectToForm(active)), [active?.id]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = {
        num: form.num, title: form.title, subtitle: form.subtitle, category: form.category, description: form.description,
        longDescription: form.longDescription, overview: form.overview, detail: form.detail, role: form.role, period: form.period,
        features: JSON.stringify(form.features.split("\n").filter(Boolean).map((title) => ({ title, detail: "", doc: "#" }))),
        tags: JSON.stringify(commaList(form.tags)), stack: JSON.stringify(commaList(form.stack)), imageUrl: form.imageUrl, link: form.link, github: form.github,
      };
      await saveJson(active ? `/api/projects/${active.id}` : "/api/projects", active ? "PUT" : "POST", token, body);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const create = () => {
    setActiveId(null);
    setForm(projectToForm(null));
  };

  const remove = async (project: ApiProject) => {
    if (!confirm(`确定删除「${project.title}」吗？`)) return;
    await fetch(`/api/projects/${project.id}`, { method: "DELETE", headers: authHeader(token) });
    await onRefresh();
  };

  return (
    <div className="flex min-h-full min-w-[1040px] overflow-x-auto">
      <ListPane title="项目" count={projects.length} addLabel="新建项目" onAdd={create}>
        {projects.map((project) => (
          <ListRow key={project.id} active={active?.id === project.id} title={project.title} meta={[project.category, project.period].filter(Boolean).join(" · ")} onClick={() => setActiveId(project.id)} onDelete={() => remove(project)} />
        ))}
      </ListPane>
      <main className="min-w-[420px] flex-1 overflow-y-auto px-11 py-[26px]">
        <div className="max-w-[640px]">
          <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3"><Field label="编号"><Input value={form.num} onChange={(value) => setForm({ ...form, num: value })} /></Field><Field label="标题"><Input value={form.title} onChange={(value) => setForm({ ...form, title: value })} /></Field></div>
          <Field label="副标题"><Input value={form.subtitle} onChange={(value) => setForm({ ...form, subtitle: value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="分类"><Input value={form.category} onChange={(value) => setForm({ ...form, category: value })} /></Field><Field label="周期"><Input value={form.period} onChange={(value) => setForm({ ...form, period: value })} /></Field></div>
          <Field label="简介"><Textarea value={form.description} onChange={(value) => setForm({ ...form, description: value })} rows={3} /></Field>
          <Field label="封面图片"><div className="flex gap-2"><Input value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} /><UploadButton onFile={async (file) => setForm({ ...form, imageUrl: await uploadMarkdownAsset(file) })} /></div></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="标签（逗号分隔）"><Input value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} /></Field><Field label="技术栈（逗号分隔）"><Input value={form.stack} onChange={(value) => setForm({ ...form, stack: value })} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="角色"><Input value={form.role} onChange={(value) => setForm({ ...form, role: value })} /></Field><Field label="外部链接"><Input value={form.link} onChange={(value) => setForm({ ...form, link: value })} /></Field></div>
          <Field label="项目概述"><Textarea value={form.overview} onChange={(value) => setForm({ ...form, overview: value })} rows={5} /></Field>
          <Field label="核心功能（每行一条）"><Textarea value={form.features} onChange={(value) => setForm({ ...form, features: value })} rows={4} /></Field>
          <Field label="详情介绍 Markdown"><Textarea value={form.detail} onChange={(value) => setForm({ ...form, detail: value })} rows={8} mono /></Field>
          <SaveBar saving={saving} canSave={!!form.title.trim()} onSave={save} />
        </div>
      </main>
      <PreviewPane label="作品集卡片预览"><ProjectPreview form={form} /></PreviewPane>
    </div>
  );
}

export function ExperienceScreen({ experiences, token, onRefresh }: { experiences: ApiExperience[]; token: string; onRefresh: () => Promise<void> }) {
  const [activeId, setActiveId] = useState<number | null>(experiences[0]?.id ?? null);
  const active = experiences.find((experience) => experience.id === activeId) ?? experiences[0] ?? null;
  const [form, setForm] = useState(() => experienceToForm(active));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (experiences.length && !experiences.some((item) => item.id === activeId)) setActiveId(experiences[0].id); }, [experiences, activeId]);
  useEffect(() => setForm(experienceToForm(active)), [active?.id]);

  const save = async () => {
    if (!form.company.trim()) return;
    setSaving(true);
    try {
      await saveJson(active ? `/api/experiences/${active.id}` : "/api/experiences", active ? "PUT" : "POST", token, {
        company: form.company, role: form.role, date: form.date, description: form.description,
        achievements: JSON.stringify(form.achievements.split("\n").map((item) => item.trim()).filter(Boolean)),
        techStack: JSON.stringify(commaList(form.techStack)),
      });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: ApiExperience) => {
    if (!confirm(`确定删除「${item.company}」这段经历吗？`)) return;
    await fetch(`/api/experiences/${item.id}`, { method: "DELETE", headers: authHeader(token) });
    await onRefresh();
  };
  return (
    <div className="flex min-h-full min-w-[1040px] overflow-x-auto">
      <ListPane title="经历" count={experiences.length} addLabel="新建经历" onAdd={() => { setActiveId(null); setForm(experienceToForm(null)); }}>
        {experiences.map((item) => <ListRow key={item.id} active={active?.id === item.id} title={item.company} meta={item.date ?? ""} onClick={() => setActiveId(item.id)} onDelete={() => remove(item)} />)}
      </ListPane>
      <main className="min-w-[420px] flex-1 overflow-y-auto px-11 py-[26px]">
        <div className="max-w-[640px]">
          <Field label="公司"><Input value={form.company} onChange={(value) => setForm({ ...form, company: value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="职位"><Input value={form.role} onChange={(value) => setForm({ ...form, role: value })} /></Field><Field label="时间"><Input value={form.date} onChange={(value) => setForm({ ...form, date: value })} /></Field></div>
          <Field label="描述"><Textarea value={form.description} onChange={(value) => setForm({ ...form, description: value })} rows={4} /></Field>
          <Field label="主要成果（每行一条）"><Textarea value={form.achievements} onChange={(value) => setForm({ ...form, achievements: value })} rows={5} /></Field>
          <Field label="技术栈（逗号分隔）"><Input value={form.techStack} onChange={(value) => setForm({ ...form, techStack: value })} /></Field>
          <SaveBar saving={saving} canSave={!!form.company.trim()} onSave={save} />
        </div>
      </main>
      <PreviewPane label="经历卡片预览"><ExperiencePreview form={form} /></PreviewPane>
    </div>
  );
}

export function BlogEditorScreen({
  posts,
  token,
  uploadMarkdownAsset,
  importMarkdown,
  pendingImportCount,
  requestAssetDirectory,
  requestAssetFiles,
  onRefresh,
}: {
  posts: ApiPost[];
  token: string;
  uploadMarkdownAsset: UploadMarkdownAsset;
  importMarkdown: (files: FileList | null, apply: (markdown: string, file: File) => void) => Promise<void>;
  pendingImportCount: number;
  requestAssetDirectory: () => void;
  requestAssetFiles: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<number | null>(posts[0]?.id ?? null);
  const [optimisticPost, setOptimisticPost] = useState<ApiPost | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<number | null>(null);
  const pendingPostIdRef = useRef<number | null>(null);
  const visiblePosts = useMemo(() => optimisticPost && !posts.some((post) => post.id === optimisticPost.id) ? [optimisticPost, ...posts] : posts, [optimisticPost, posts]);
  const active = activeId === null ? null : visiblePosts.find((post) => post.id === activeId) ?? null;
  const [form, setForm] = useState(() => postToForm(active));
  const [saving, setSaving] = useState(false);
  const [propsOpen, setPropsOpen] = useState(true);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const headings = useMemo(() => extractMarkdownHeadings(form.content), [form.content]);
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    for (const post of posts) {
      const value = post.category?.trim();
      if (value) categories.add(value);
    }
    if (form.category.trim()) categories.add(form.category.trim());
    return Array.from(categories).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [form.category, posts]);
  const computedReadTime = useMemo(() => estimateReadTime(form.content), [form.content]);
  useEffect(() => {
    setActiveId((current) => {
      if (current === null) return current;
      if (posts.some((post) => post.id === current)) {
        if (pendingPostIdRef.current === current) pendingPostIdRef.current = null;
        if (optimisticPost?.id === current) setOptimisticPost(null);
        return current;
      }
      if (pendingPostIdRef.current === current) return current;
      return posts[0]?.id ?? null;
    });
  }, [optimisticPost?.id, posts]);
  useEffect(() => { if (active) setForm(postToForm(active)); }, [active?.id]);
  const scrollToHeading = (heading: MarkdownHeading) => scrollEditorToHeading(contentScrollRef.current, heading.id);
  const createPost = async () => {
    const draft = withComputedReadTime(newPostForm());
    const created = await saveJson<{ id: number }>("/api/posts", "POST", token, draft);
    const nextPost: ApiPost = {
      id: created.id,
      sortOrder: null,
      title: draft.title,
      category: draft.category,
      snippet: draft.snippet,
      date: draft.date,
      readTime: draft.readTime,
      content: draft.content,
    };
    pendingPostIdRef.current = created.id;
    setOptimisticPost(nextPost);
    setActiveId(created.id);
    setForm(draft);
    await onRefresh();
  };
  const reorderPosts = async (targetId: number, placement: "before" | "after") => {
    if (draggingPostId === null || draggingPostId === targetId) return;
    const ids = posts.map((post) => post.id);
    if (!ids.includes(draggingPostId) || !ids.includes(targetId)) return;
    const nextIds = ids.filter((id) => id !== draggingPostId);
    const targetIndex = nextIds.indexOf(targetId);
    nextIds.splice(placement === "after" ? targetIndex + 1 : targetIndex, 0, draggingPostId);
    await saveJson("/api/posts/reorder", "PUT", token, { ids: nextIds });
    await onRefresh();
  };
  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await saveJson(active ? `/api/posts/${active.id}` : "/api/posts", active ? "PUT" : "POST", token, withComputedReadTime(form));
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid h-full min-h-0 overflow-hidden grid-cols-[240px_minmax(0,1fr)_264px]">
      <EditorList title="全部文章" addLabel="新建文章" count={visiblePosts.length} onAdd={createPost}>
        {visiblePosts.map((post) => (
          <EditorListRow
            key={post.id}
            active={active?.id === post.id}
            title={post.title}
            meta={post.date ?? ""}
            accent="blog"
            draggable={!optimisticPost || optimisticPost.id !== post.id}
            dragging={draggingPostId === post.id}
            onClick={() => setActiveId(post.id)}
            onDelete={async () => { if (confirm(`确定删除「${post.title}」吗？`)) { await fetch(`/api/posts/${post.id}`, { method: "DELETE", headers: authHeader(token) }); await onRefresh(); } }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(post.id));
              setDraggingPostId(post.id);
            }}
            onDragOver={(event) => { if (draggingPostId !== null && draggingPostId !== post.id) event.preventDefault(); }}
            onDrop={async (event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              await reorderPosts(post.id, event.clientY > rect.top + rect.height / 2 ? "after" : "before");
              setDraggingPostId(null);
            }}
            onDragEnd={() => setDraggingPostId(null)}
          />
        ))}
      </EditorList>
      <main className="flex min-h-0 flex-col overflow-hidden">
        <EditorHeader
          title={form.title || "无标题文章"}
          eyebrow="Knowledge Base · 博客"
          saving={saving}
          accent="blog"
          onSave={save}
          canSave={!!form.title.trim()}
          pendingImportCount={pendingImportCount}
          importMarkdown={(files) => importMarkdown(files, (markdown, file) => setForm((current) => ({ ...current, content: markdown, title: getMarkdownTitleFromFileName(file.name) })))}
          requestAssetDirectory={requestAssetDirectory}
          requestAssetFiles={requestAssetFiles}
        />
        <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[880px] px-6 py-12 pb-[100px] md:px-11 md:py-14">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="无标题文章" className="mb-4 block w-full bg-transparent font-display text-[34px] font-black leading-[1.2] text-gray-900 outline-none placeholder:text-gray-300" />
          <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50">
            <button type="button" onClick={() => setPropsOpen(!propsOpen)} className="flex w-full items-center gap-1.5 px-3 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
              {propsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} 属性
            </button>
            {propsOpen && (
              <div className="px-3.5 pb-3">
                <CategoryPropRow
                  icon={<Tag />}
                  value={form.category}
                  options={categoryOptions}
                  onChange={(value) => setForm({ ...form, category: value })}
                />
                <PropRow icon={<Calendar />} label="日期" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
                <ReadTimeRow icon={<Clock />} value={computedReadTime} />
                <PropRow icon={<AlignLeft />} label="摘要" value={form.snippet} onChange={(value) => setForm({ ...form, snippet: value })} />
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 pt-6">
            <LiveMarkdownEditor value={form.content} onChange={(content) => setForm((current) => ({ ...current, content }))} docKey={`blog-${active?.id ?? "new"}`} uploadMarkdownAsset={uploadMarkdownAsset} accent="blog" />
          </div>
          </div>
        </div>
      </main>
      <HeadingTree key={`blog-${active?.id ?? "new"}`} headings={headings} onSelect={scrollToHeading} accent="blog" />
    </div>
  );
}

export function DocsEditorScreen({
  docs,
  token,
  uploadMarkdownAsset,
  importMarkdown,
  pendingImportCount,
  requestAssetDirectory,
  requestAssetFiles,
  onRefresh,
}: {
  docs: DocNode[];
  token: string;
  uploadMarkdownAsset: UploadMarkdownAsset;
  importMarkdown: (files: FileList | null, apply: (markdown: string, file: File) => void) => Promise<void>;
  pendingImportCount: number;
  requestAssetDirectory: () => void;
  requestAssetFiles: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(firstLeaf(docs)?.id ?? null);
  const pendingDocIdRef = useRef<string | null>(null);
  const active = findEditableDoc(docs, activeId);
  const [form, setForm] = useState({ title: active?.title ?? "", content: active?.content ?? "" });
  const [saving, setSaving] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const headings = useMemo(() => extractMarkdownHeadings(form.content), [form.content]);
  useEffect(() => {
    setActiveId((current) => {
      const editable = findEditableDoc(docs, current);
      if (editable) {
        if (pendingDocIdRef.current === editable.id) pendingDocIdRef.current = null;
        return editable.id;
      }
      if (current && pendingDocIdRef.current === current) return current;
      return firstLeaf(docs)?.id ?? null;
    });
  }, [docs]);
  useEffect(() => {
    if (active) {
      setForm({ title: active.title, content: active.content ?? "" });
    } else {
      setForm({ title: "", content: "" });
    }
  }, [active?.id]);
  const scrollToHeading = (heading: MarkdownHeading) => scrollEditorToHeading(contentScrollRef.current, heading.id);
  const save = async () => {
    if (!form.title.trim()) return;
    if (!active) return;
    setSaving(true);
    try {
      await saveJson(`/api/docs/${active.id}`, "PUT", token, form);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };
  const createDoc = async (parentId: string | null, isFolder: boolean) => {
    const title = isFolder ? "未命名目录" : "新建文档";
    const created = await saveJson<{ id: number }>("/api/docs", "POST", token, { parentId, title, isFolder, content: "" });
    if (!isFolder) {
      const nextId = String(created.id);
      pendingDocIdRef.current = nextId;
      setActiveId(nextId);
      setForm({ title, content: "" });
    }
    await onRefresh();
  };
  const move = async (movedId: string, newParentId: string | null, oldSiblingIds: string[], newSiblingIds: string[]) => {
    await saveJson("/api/docs/move", "PUT", token, { movedId, newParentId, oldSiblingIds, newSiblingIds });
    await onRefresh();
  };
  const rename = async (node: DocNode, title: string) => {
    await saveJson(`/api/docs/${node.id}`, "PUT", token, { title, content: node.content ?? "" });
    await onRefresh();
  };
  const remove = async (node: DocNode) => {
    if (!confirm(`确定删除「${node.title}」吗？`)) return;
    await fetch(`/api/docs/${node.id}`, { method: "DELETE", headers: authHeader(token) });
    if (activeId === node.id) setActiveId(null);
    await onRefresh();
  };
  return (
    <div className="grid h-full min-h-0 overflow-hidden grid-cols-[240px_minmax(0,1fr)_264px]">
      <aside className="h-full min-h-0 overflow-y-auto border-r border-gray-100 px-3 py-[18px]">
        <DocsTree docs={docs} activeId={activeId} onSelect={(node) => setActiveId(node.id)} onNewRoot={(isFolder) => createDoc(null, isFolder)} onNewChild={(parentId, isFolder) => createDoc(parentId, isFolder)} onRename={rename} onDelete={remove} onMove={move} />
      </aside>
      <main className="flex min-h-0 flex-col overflow-hidden">
        <EditorHeader
          title={active ? form.title || "无标题文档" : "面经编辑"}
          eyebrow="Interview Notes · 面经"
          saving={saving}
          accent="docs"
          onSave={save}
          canSave={!!active && !!form.title.trim()}
          pendingImportCount={pendingImportCount}
          importMarkdown={(files) => importMarkdown(files, (markdown, file) => setForm((current) => ({ ...current, content: markdown, title: getMarkdownTitleFromFileName(file.name) })))}
          requestAssetDirectory={requestAssetDirectory}
          requestAssetFiles={requestAssetFiles}
        />
        <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[880px] px-6 py-12 pb-[100px] md:px-11 md:py-14">
          {active ? (
            <>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="无标题文档" className="mb-4 block w-full bg-transparent font-display text-[32px] font-black leading-[1.2] text-gray-900 outline-none placeholder:text-gray-300" />
              <div className="border-t border-gray-100 pt-6">
                <LiveMarkdownEditor value={form.content} onChange={(content) => setForm((current) => ({ ...current, content }))} docKey={`doc-${active.id}`} uploadMarkdownAsset={uploadMarkdownAsset} accent="docs" />
              </div>
            </>
          ) : <div className="py-20 text-center text-sm text-gray-400">从左侧选择或新建一篇文档</div>}
          </div>
        </div>
      </main>
      <HeadingTree key={`doc-${active?.id ?? "empty"}`} headings={headings} onSelect={scrollToHeading} accent="docs" />
    </div>
  );
}

function flattenDocs(nodes: DocNode[], trail: string[] = []): Array<{ node: DocNode; trail: string[] }> {
  return nodes.flatMap((node) => [{ node, trail: [...trail, node.title] }, ...(node.children ? flattenDocs(node.children, [...trail, node.title]) : [])]);
}

function scrollEditorToHeading(container: HTMLDivElement | null, headingId: string) {
  const target = container?.querySelector(`#${CSS.escape(headingId)}`);
  if (!container || !(target instanceof HTMLElement)) return;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  container.scrollTo({
    top: container.scrollTop + targetRect.top - containerRect.top - 28,
    behavior: "smooth",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-4 block"><div className="mb-1.5 text-xs font-bold text-gray-500">{label}</div>{children}</label>;
}
function Input({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-[9px] text-sm text-gray-800 outline-none transition-colors focus:border-indigo-300" />;
}
function Textarea({ value, onChange, rows = 3, mono = false }: { value: string; onChange: (value: string) => void; rows?: number; mono?: boolean }) {
  return <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className={`w-full resize-y rounded-[10px] border border-gray-200 bg-white px-3 py-[9px] text-sm leading-6 text-gray-800 outline-none transition-colors focus:border-indigo-300 ${mono ? "font-mono" : ""}`} />;
}
function UploadButton({ onFile }: { onFile: (file: File) => void }) {
  return <label className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-dashed border-gray-200 px-3 text-xs font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-600"><input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /><UploadCloud className="h-4 w-4" />上传</label>;
}
function SaveBar({ saving, canSave, onSave }: { saving: boolean; canSave: boolean; onSave: () => void }) {
  return <div className="sticky bottom-0 mt-6 flex justify-end border-t border-gray-100 bg-white py-4"><button type="button" onClick={onSave} disabled={saving || !canSave} className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-45">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存发布</button></div>;
}
function ListPane({ title, count, addLabel, onAdd, children }: { title: string; count: number; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-gray-100 px-3 py-[18px]"><button type="button" onClick={onAdd} className="mb-3.5 flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] font-bold text-gray-600 hover:bg-gray-50"><Plus className="h-[13px] w-[13px]" />{addLabel}</button><div className="px-1 pb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">{title} · {count}</div>{children}</aside>;
}
function ListRow({ active, title, meta, onClick, onDelete }: { active: boolean; title: string; meta: string; onClick: () => void; onDelete: () => void }) {
  return <div onClick={onClick} className={`group mb-0.5 flex cursor-pointer items-start gap-2 rounded-[9px] px-2.5 py-2.5 ${active ? "bg-gray-100" : "hover:bg-gray-50"}`}><div className="min-w-0 flex-1"><div className="truncate font-display text-[13px] font-bold text-gray-800">{title}</div><div className="mt-0.5 truncate text-[11px] text-gray-400">{meta || "未设置"}</div></div><button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} className="rounded-md p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></div>;
}
function PreviewPane({ label, children }: { label: string; children: React.ReactNode }) {
  return <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50 px-7 py-[26px]"><div className="mb-3.5 flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-widest text-gray-400"><Eye className="h-3 w-3" />{label}</div>{children}</aside>;
}
function ProjectPreview({ form }: { form: ReturnType<typeof projectToForm> }) {
  const project: Project = { id: "preview", num: form.num, title: form.title || "未命名项目", subtitle: form.subtitle, category: form.category as Project["category"], period: form.period, description: form.description || "项目简介会显示在这里。", tags: commaList(form.tags), stack: commaList(form.stack), imageUrl: form.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='800' height='500' fill='%23eef2ff'/%3E%3C/svg%3E" };
  return <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"><div className="relative h-44 overflow-hidden rounded-xl bg-gray-100"><img src={project.imageUrl} alt="" className="h-full w-full object-cover" /><div className="absolute left-3 top-3 flex gap-1.5">{project.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-indigo-700">{tag}</span>)}</div></div><div className="p-4"><div className="font-mono text-[11px] uppercase text-gray-400">PROJECT {project.num || "00"}</div><h3 className="mt-1 font-display text-xl font-bold text-gray-900">{project.title}</h3><p className="mt-2 text-sm leading-6 text-[#24315f]">{project.description}</p></div></div>;
}
function ExperiencePreview({ form }: { form: ReturnType<typeof experienceToForm> }) {
  return <div className="rounded-2xl border border-gray-100 bg-white px-6 py-5"><div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[11.5px] font-bold text-indigo-600"><Building2 className="h-3.5 w-3.5" />{form.company || "公司名称"}</div><h3 className="font-display text-xl font-extrabold text-gray-900">{form.role || "职位"}</h3><div className="mt-1 font-mono text-[11.5px] text-gray-400">{form.date}</div><p className="my-4 text-[13.5px] leading-7 text-gray-600">{form.description}</p><div className="space-y-2">{form.achievements.split("\n").filter(Boolean).map((item) => <div key={item} className="flex gap-2 text-[13px] leading-6 text-gray-700"><CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" />{item}</div>)}</div><div className="mt-4 flex flex-wrap gap-1.5">{commaList(form.techStack).map((item) => <span key={item} className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{item}</span>)}</div></div>;
}
function EditorList({ title, count, addLabel, onAdd, children }: { title: string; count: number; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return <aside className="h-full min-h-0 overflow-y-auto border-r border-gray-100 px-3 py-[18px]"><button type="button" onClick={onAdd} className="mb-3.5 flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] font-bold text-gray-600 hover:bg-gray-50"><Plus className="h-[13px] w-[13px]" />{addLabel}</button><div className="px-1 pb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">{title} · {count}</div>{children}</aside>;
}
function EditorListRow({
  active,
  title,
  meta,
  accent,
  draggable = false,
  dragging = false,
  onClick,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  active: boolean;
  title: string;
  meta: string;
  accent: "blog" | "docs";
  draggable?: boolean;
  dragging?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}) {
  const activeClass = accent === "docs" ? "bg-[color-mix(in_oklab,var(--seal)_10%,white)] text-[var(--seal)]" : "bg-[var(--signal-indigo-50)] text-[var(--signal-indigo-600)]";
  return (
    <div
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group mb-0.5 flex cursor-pointer items-start gap-2 rounded-[9px] px-2.5 py-2.5 transition-opacity ${active ? activeClass : "text-gray-700 hover:bg-gray-50"} ${dragging ? "opacity-45" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[13px] font-bold">{title}</div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-gray-400">{meta || "未设置"}</div>
      </div>
      <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} className="rounded-md p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}
function EditorHeader({
  title,
  eyebrow,
  saving,
  accent,
  onSave,
  canSave,
  pendingImportCount,
  importMarkdown,
  requestAssetDirectory,
  requestAssetFiles,
}: {
  title: string;
  eyebrow: string;
  saving: boolean;
  accent: "blog" | "docs";
  onSave: () => void;
  canSave: boolean;
  pendingImportCount: number;
  importMarkdown: (files: FileList | null) => void;
  requestAssetDirectory: () => void;
  requestAssetFiles: () => void;
}) {
  const hasPendingAssets = pendingImportCount > 0;
  const assetButtonClass = `rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold transition-colors ${
    hasPendingAssets ? "text-gray-500 hover:bg-gray-50" : "cursor-not-allowed text-gray-300"
  }`;
  return (
    <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white px-6">
      <div className="min-w-0">
        <div className={`font-mono text-[10.5px] font-bold uppercase tracking-widest ${accent === "docs" ? "text-[var(--seal)]" : "text-[var(--signal-indigo-600)]"}`}>{eyebrow}</div>
        <div className="mt-0.5 truncate font-display text-[15px] font-bold text-gray-900">{title}</div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <label className="cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50">
          <input type="file" accept=".md,.markdown" className="hidden" onChange={(event) => { importMarkdown(event.target.files); event.currentTarget.value = ""; }} />
          导入 MD
        </label>
        <button type="button" disabled={!hasPendingAssets} title={hasPendingAssets ? "选择图片所在文件夹并自动匹配 Markdown 本地图片路径" : "导入含本地图片引用的 MD 后可用"} onClick={requestAssetDirectory} className={assetButtonClass}>
          图片位置
        </button>
        <button type="button" disabled={!hasPendingAssets} title={hasPendingAssets ? "选择单张或多张图片文件并自动匹配 Markdown 本地图片路径" : "导入含本地图片引用的 MD 后可用"} onClick={requestAssetFiles} className={assetButtonClass}>
          图片文件
        </button>
        {hasPendingAssets && <span className="font-mono text-[11px] text-amber-600">{pendingImportCount} 张图片待匹配</span>}
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-400"><span className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-amber-500" : "bg-emerald-500"}`} />{saving ? "保存中..." : "已保存"}</div>
        <button type="button" onClick={onSave} disabled={!canSave || saving} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45">保存</button>
      </div>
    </div>
  );
}
function HeadingTree({
  headings,
  onSelect,
  accent,
}: {
  headings: MarkdownHeading[];
  onSelect: (heading: MarkdownHeading) => void;
  accent: "blog" | "docs";
}) {
  const tree = useMemo(() => buildMarkdownHeadingTree(headings), [headings]);
  const collapsibleKeys = useMemo(() => {
    const keys: string[] = [];
    const visit = (nodes: typeof tree) => nodes.forEach((node) => {
      if (node.children.length > 0) keys.push(getMarkdownHeadingKey(node));
      visit(node.children);
    });
    visit(tree);
    return keys;
  }, [tree]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const visibleHeadings = useMemo(() => flattenVisibleMarkdownHeadingTree(tree, collapsed), [collapsed, tree]);
  const allCollapsed = collapsibleKeys.length > 0 && collapsibleKeys.every((key) => collapsed.has(key));
  const accentStyles = accent === "docs"
    ? {
        icon: "bg-rose-50 text-[var(--seal)] ring-rose-100",
        active: "bg-rose-50/80 text-[var(--seal)] ring-rose-100/80",
        activeRail: "bg-[var(--seal)]",
        activeLevel: "bg-white text-[var(--seal)] ring-rose-100",
      }
    : {
        icon: "bg-indigo-50 text-[var(--signal-indigo-600)] ring-indigo-100",
        active: "bg-indigo-50/80 text-[var(--signal-indigo-600)] ring-indigo-100/80",
        activeRail: "bg-[var(--signal-indigo-600)]",
        activeLevel: "bg-white text-[var(--signal-indigo-600)] ring-indigo-100",
      };
  const toggleHeading = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-gray-100 bg-[#fcfcfd]">
      <div className="flex min-h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white/80 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ${accentStyles.icon}`}>
            <ListTree className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[14px] font-bold text-gray-900">文章目录</div>
            <div className="mt-0.5 text-[10.5px] text-gray-400">{headings.length > 0 ? `${headings.length} 个标题节点` : "根据标题自动生成"}</div>
          </div>
        </div>
        {collapsibleKeys.length > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(collapsibleKeys))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
            title={allCollapsed ? "展开全部标题" : "收起全部标题"}
            aria-label={allCollapsed ? "展开全部标题" : "收起全部标题"}
          >
            {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3.5">
        {headings.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/70 px-4 text-center">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-300">
              <ListTree className="h-4 w-4" />
            </span>
            <div className="text-xs font-semibold text-gray-500">暂无文章目录</div>
            <div className="mt-1.5 text-[10.5px] leading-4 text-gray-400">输入 Markdown 标题后<br />将在这里生成层级结构</div>
          </div>
        ) : (
          <div className="space-y-1">
            {visibleHeadings.map((heading) => {
              const key = getMarkdownHeadingKey(heading);
              const hasChildren = heading.children.length > 0;
              const isCollapsed = collapsed.has(key);
              const isActive = activeKey === key;
              return (
              <div
                key={key}
                className={`group relative flex w-full items-center rounded-[10px] py-1.5 pr-2 text-xs leading-5 ring-1 ring-transparent transition-all duration-150 ${isActive ? accentStyles.active : "text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm hover:ring-gray-100"}`}
                style={{ paddingLeft: `${heading.depth * 14 + 5}px` }}
              >
                {isActive && <span aria-hidden="true" className={`absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full ${accentStyles.activeRail}`} />}
                {heading.depth > 0 && (
                  <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px bg-gray-200/80" style={{ left: `${heading.depth * 14 - 3}px` }} />
                )}
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleHeading(key)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-white hover:text-gray-700 hover:shadow-sm"
                    aria-label={isCollapsed ? `展开 ${heading.text}` : `收起 ${heading.text}`}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />}
                  </button>
                ) : (
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? accentStyles.activeRail : "bg-gray-300 group-hover:bg-gray-400"}`} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveKey(key);
                    onSelect(heading);
                  }}
                  title={`${heading.hasSkippedLevel ? "存在标题跳级 · " : ""}H${heading.level} · 第 ${heading.line} 行`}
                  className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
                >
                  <span className={`min-w-0 flex-1 truncate ${heading.depth === 0 ? "font-bold" : "font-medium"}`}>{heading.text}</span>
                  <span className={`shrink-0 rounded-md px-1.5 font-mono text-[9px] font-bold leading-[18px] ring-1 ${heading.hasSkippedLevel ? "bg-amber-50 text-amber-600 ring-amber-100" : isActive ? accentStyles.activeLevel : "bg-gray-50 text-gray-400 ring-gray-100 group-hover:bg-white"}`}>
                    H{heading.level}
                  </span>
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
function PropRow({ icon, label, value, onChange }: { icon: React.ReactElement<{ className?: string }>; label: string; value: string; onChange: (value: string) => void }) {
  return <div className="flex items-center gap-2.5 px-0.5 py-1.5"><div className="flex w-[92px] shrink-0 items-center gap-1.5 text-[12.5px] text-gray-400">{icon && { ...icon, props: { ...icon.props, className: "h-[13px] w-[13px]" } }}{label}</div><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[13.5px] text-gray-700 outline-none focus:bg-white" /></div>;
}
function CategoryPropRow({
  icon,
  value,
  options,
  onChange,
}: {
  icon: React.ReactElement<{ className?: string }>;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim();
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(normalizedValue.toLowerCase()));
  const exactMatch = options.some((option) => option === normalizedValue);
  return (
    <div className="relative flex items-center gap-2.5 px-0.5 py-1.5">
      <div className="flex w-[92px] shrink-0 items-center gap-1.5 text-[12.5px] text-gray-400">
        {icon && { ...icon, props: { ...icon.props, className: "h-[13px] w-[13px]" } }}分类
      </div>
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="选择或输入新分类"
        className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[13.5px] text-gray-700 outline-none focus:bg-white"
      />
      {open && (
        <div className="absolute left-[103px] right-0 top-[34px] z-30 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.12)]">
          <div className="border-b border-gray-100 px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-wider text-gray-400">已有分类</div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              >
                <span className="min-w-0 truncate">{option}</span>
                <span className="font-mono text-[10px] font-bold text-gray-300">选择</span>
              </button>
            )) : (
              <div className="px-3 py-3 text-xs text-gray-400">暂无匹配分类</div>
            )}
          </div>
          {normalizedValue && !exactMatch && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-left text-[13px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              <Plus className="h-3.5 w-3.5" />
              新建分类：{normalizedValue}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function ReadTimeRow({ icon, value }: { icon: React.ReactElement<{ className?: string }>; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5 py-1.5">
      <div className="flex w-[92px] shrink-0 items-center gap-1.5 text-[12.5px] text-gray-400">
        {icon && { ...icon, props: { ...icon.props, className: "h-[13px] w-[13px]" } }}阅读时长
      </div>
      <div className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-[13.5px] text-gray-700">{value}</div>
      <div className="shrink-0 font-mono text-[10.5px] font-bold text-gray-300">自动</div>
    </div>
  );
}
function projectToForm(project: ApiProject | null) {
  return { num: project?.num ?? "", title: project?.title ?? "", subtitle: project?.subtitle ?? "", category: project?.category ?? "", period: project?.period ?? "", description: project?.description ?? "", imageUrl: project?.imageUrl ?? "", tags: project?.tags ? safeParseArray(project.tags).join(", ") : "", stack: project?.stack ? safeParseArray(project.stack).join(", ") : "", role: project?.role ?? "", link: project?.link ?? "", github: project?.github ?? "", overview: project?.overview ?? "", longDescription: project?.longDescription ?? "", features: project?.features ? safeParseArray(project.features).map((item: any) => typeof item === "string" ? item : item.title).filter(Boolean).join("\n") : "", detail: project?.detail ?? "" };
}
function experienceToForm(item: ApiExperience | null) {
  return { company: item?.company ?? "", role: item?.role ?? "", date: item?.date ?? "", description: item?.description ?? "", achievements: item?.achievements ? safeParseArray(item.achievements).join("\n") : "", techStack: item?.techStack ? safeParseArray(item.techStack).join(", ") : "" };
}
function postToForm(post: ApiPost | null) {
  const content = post?.content ?? "";
  return { title: post?.title ?? "", category: post?.category ?? "", snippet: post?.snippet ?? "", date: post?.date ?? new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }), readTime: estimateReadTime(content), content };
}
function newPostForm() {
  return { ...postToForm(null), title: "新建文章" };
}
function estimateReadTime(markdown: string) {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~>#|[\]()-]/g, " ");
  const cjkCount = (plainText.match(/[\u3400-\u9fff]/g) ?? []).length;
  const wordCount = (plainText.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? []).length;
  const estimatedMinutes = Math.max(1, Math.ceil((cjkCount + wordCount * 1.6) / 450));
  return `${estimatedMinutes} 分钟阅读`;
}
function withComputedReadTime<T extends { content: string; readTime: string }>(form: T): T {
  return { ...form, readTime: estimateReadTime(form.content) };
}
function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
async function saveJson<T = unknown>(url: string, method: "POST" | "PUT", token: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "保存失败");
  return (await response.json().catch(() => undefined)) as T;
}
