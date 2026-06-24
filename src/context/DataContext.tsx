import { createContext, useContext, useEffect, useState } from "react";
import { projects as staticProjects, blogPosts as staticPosts, knowledgeDocs as staticDocs } from "../data";
import type { Project, BlogPost, DocNode } from "../data";

interface DataContextType {
  projects: Project[];
  posts: BlogPost[];
  docs: DocNode[];
  loading: boolean;
  refresh: () => void;
}

const DataContext = createContext<DataContextType>({
  projects: staticProjects,
  posts: staticPosts,
  docs: staticDocs,
  loading: false,
  refresh: () => {},
});

function mapApiProject(p: any): Project {
  return {
    id: String(p.id),
    title: p.title ?? "",
    description: p.description ?? "",
    longDescription: p.longDescription ?? undefined,
    features: p.features ? JSON.parse(p.features) : undefined,
    tags: p.tags ? JSON.parse(p.tags) : [],
    imageUrl: p.imageUrl ?? "",
    link: p.link || undefined,
    github: p.github || undefined,
  };
}

function mapApiPost(p: any): BlogPost {
  return {
    id: String(p.id),
    title: p.title ?? "",
    snippet: p.snippet ?? "",
    content: p.content ?? undefined,
    date: p.date ?? "",
    readTime: p.readTime ?? "",
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(staticProjects);
  const [posts, setPosts] = useState<BlogPost[]>(staticPosts);
  const [docs, setDocs] = useState<DocNode[]>(staticDocs);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [projRes, postsRes, docsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/posts"),
        fetch("/api/docs"),
      ]);
      const [apiProjects, apiPosts, apiDocs] = await Promise.all([
        projRes.ok ? projRes.json() : [],
        postsRes.ok ? postsRes.json() : [],
        docsRes.ok ? docsRes.json() : [],
      ]);
      // 只有 API 有数据时才覆盖静态数据，保证初始展示不为空
      if (apiProjects.length > 0) setProjects(apiProjects.map(mapApiProject));
      if (apiPosts.length > 0) setPosts(apiPosts.map(mapApiPost));
      if (apiDocs.length > 0) setDocs(apiDocs as DocNode[]);
    } catch {
      // 网络错误时保留静态数据
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <DataContext.Provider value={{ projects, posts, docs, loading, refresh: fetchAll }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
