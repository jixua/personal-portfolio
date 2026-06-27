import { createContext, useContext, useEffect, useState } from "react";
import type { Project, BlogPost, DocNode, Experience } from "../data";

interface DataContextType {
  projects: Project[];
  posts: BlogPost[];
  docs: DocNode[];
  experiences: Experience[];
  loading: boolean;
  refresh: () => void;
}

const DataContext = createContext<DataContextType>({
  projects: [],
  posts: [],
  docs: [],
  experiences: [],
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

function mapApiExperience(e: any): Experience {
  return {
    id: String(e.id),
    company: e.company ?? "",
    role: e.role ?? "",
    date: e.date ?? "",
    description: e.description ?? "",
    achievements: e.achievements ? JSON.parse(e.achievements) : [],
    techStack: e.techStack ? JSON.parse(e.techStack) : [],
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [docs, setDocs] = useState<DocNode[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [projRes, postsRes, docsRes, expRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/posts"),
        fetch("/api/docs"),
        fetch("/api/experiences"),
      ]);
      const [apiProjects, apiPosts, apiDocs, apiExp] = await Promise.all([
        projRes.ok ? projRes.json() : [],
        postsRes.ok ? postsRes.json() : [],
        docsRes.ok ? docsRes.json() : [],
        expRes.ok ? expRes.json() : [],
      ]);
      setProjects(apiProjects.map(mapApiProject));
      setPosts(apiPosts.map(mapApiPost));
      setDocs(apiDocs as DocNode[]);
      setExperiences(apiExp.map(mapApiExperience));
    } catch {
      // 网络错误时保留静态数据
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <DataContext.Provider value={{ projects, posts, docs, experiences, loading, refresh: fetchAll }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
