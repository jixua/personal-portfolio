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

function parseArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapApiProject(p: any): Project {
  return {
    id: String(p.id),
    sortOrder: p.sortOrder ?? undefined,
    num: p.num ?? undefined,
    title: p.title ?? "",
    subtitle: p.subtitle ?? undefined,
    description: p.description ?? "",
    longDescription: p.longDescription ?? undefined,
    overview: p.overview ?? undefined,
    category: p.category ?? undefined,
    role: p.role ?? undefined,
    period: p.period ?? undefined,
    features: parseArray(p.features),
    tags: parseArray(p.tags),
    stack: parseArray(p.stack),
    imageUrl: p.imageUrl ?? "",
    link: p.link || undefined,
    github: p.github || undefined,
  };
}

function mapApiPost(p: any): BlogPost {
  return {
    id: String(p.id),
    sortOrder: p.sortOrder ?? undefined,
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
    achievements: parseArray(e.achievements),
    techStack: parseArray(e.techStack),
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [docs, setDocs] = useState<DocNode[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
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
    } catch (error) {
      console.error("Failed to load database content", error);
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
