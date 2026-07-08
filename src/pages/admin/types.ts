import type { DocNode } from "../../data";

export type AdminTab = "overview" | "projects" | "blog" | "docs" | "experience";
export type UploadMarkdownAsset = (file: File) => Promise<string>;

export interface ApiProject {
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
  features: string | null;
  tags: string | null;
  stack: string | null;
  imageUrl: string | null;
  link: string | null;
  github: string | null;
}

export interface ApiPost {
  id: number;
  sortOrder: number | null;
  title: string;
  category: string | null;
  snippet: string | null;
  date: string | null;
  readTime: string | null;
  content: string | null;
}

export interface ApiExperience {
  id: number;
  company: string;
  role: string | null;
  date: string | null;
  description: string | null;
  achievements: string | null;
  techStack: string | null;
}

export type EditingDoc = DocNode | null;

