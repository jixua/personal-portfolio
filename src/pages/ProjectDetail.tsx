import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Zap, FileText, CheckCircle2 } from "lucide-react";
import { useData } from "../context/DataContext";
import type { Project, ProjectFeature } from "../data";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

function isFeatureObject(f: unknown): f is ProjectFeature {
  return typeof f === "object" && f !== null && "title" in f;
}

function FeatureCard({ feature, index, isLast }: { feature: ProjectFeature; index: number; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "20px 0",
        borderBottom: isLast ? "none" : "1px solid #f3f4f6",
        transition: "all 0.2s",
      }}
    >
      {/* left accent bar */}
      <div
        style={{
          position: "absolute",
          left: -28,
          top: 0,
          bottom: 0,
          width: 3,
          background: "linear-gradient(180deg, #6366f1, #a855f7)",
          borderRadius: "0 2px 2px 0",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.25s",
        }}
      />

      {/* number */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 12,
          color: hovered ? "#4f46e5" : "#94a3b8",
          width: 22,
          flexShrink: 0,
          transition: "color 0.2s",
          paddingTop: 2,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* text */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 17,
            lineHeight: 1.55,
            color: "#111827",
            transition: "color 0.2s",
          }}
        >
          {feature.title}
        </div>
        {feature.detail && (
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.55,
              color: "#24315f",
              marginTop: 8,
              transition: "color 0.2s",
            }}
          >
            {feature.detail}
          </div>
        )}
      </div>

      {/* doc link */}
      {feature.doc && feature.doc !== "#" && (
        <a
          href={feature.doc}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: 12,
            color: hovered ? "#4f46e5" : "#64748b",
            transition: "color 0.2s",
            whiteSpace: "nowrap",
            paddingTop: 2,
          }}
        >
          文档↗
        </a>
      )}
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useData();
  const navigate = useNavigate();

  const project = projects.find((p) => p.id === id);
  const currentIndex = projects.findIndex((p) => p.id === id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p style={{ fontFamily: "var(--font-mono)", color: "#9ca3af", marginBottom: 16 }}>项目未找到</p>
          <Link to="/portfolio" className="text-indigo-600 font-medium hover:underline">返回作品集</Link>
        </div>
      </div>
    );
  }

  const features = project.features ?? [];
  const isObjectFeatures = features.length > 0 && isFeatureObject(features[0]);
  const objectFeatures = isObjectFeatures ? (features as ProjectFeature[]) : [];
  const stringFeatures = !isObjectFeatures ? (features as string[]) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[#fafafa]"
    >
      {/* Back button */}
      <div className="max-w-6xl mx-auto px-7 pt-7">
        <button
          onClick={() => navigate("/portfolio")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 38,
            padding: "0 18px",
            borderRadius: 9999,
            background: "#fff",
            border: "1px solid #e5e7eb",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: 14,
            color: "#374151",
            cursor: "pointer",
            transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#c7d2fe";
            (e.currentTarget as HTMLElement).style.color = "#4f46e5";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
            (e.currentTarget as HTMLElement).style.color = "#374151";
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          返回作品集
        </button>
      </div>

      {/* Hero image */}
      <div className="max-w-6xl mx-auto px-7 mt-6">
        <div
          style={{
            position: "relative",
            height: "clamp(280px,45vw,500px)",
            borderRadius: 32,
            overflow: "hidden",
          }}
        >
          <img
            src={project.imageUrl}
            alt={project.title}
            className="w-full h-full object-cover"
          />
          {/* gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 55%, transparent 80%)",
            }}
          />
          {/* text overlay */}
          <div
            style={{
              position: "absolute",
              left: 52,
              top: "50%",
              transform: "translateY(-50%)",
              maxWidth: "55%",
            }}
          >
            {project.num && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                }}
              >
                Project {project.num}
              </div>
            )}
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(1.75rem,3.5vw,2.5rem)",
                lineHeight: 1.1,
                color: "#fff",
                marginBottom: 12,
              }}
            >
              {project.title}
            </h1>
            {project.subtitle && (
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.68)",
                  marginBottom: 16,
                }}
              >
                {project.subtitle}
              </p>
            )}
            {project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 500,
                      background: "rgba(255,255,255,0.14)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.24)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="max-w-6xl mx-auto px-7 mt-5">
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            border: "1px solid #f3f4f6",
            boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            padding: "22px 32px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 24,
          }}
        >
          {project.role && (
            <div style={{ paddingRight: 32, borderRight: "1px solid #f3f4f6" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: 4 }}>角色</div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#111827" }}>{project.role}</div>
            </div>
          )}
          {project.period && (
            <div style={{ paddingRight: 32, borderRight: "1px solid #f3f4f6" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: 4 }}>项目周期</div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, color: "#111827" }}>{project.period}</div>
            </div>
          )}
          {(project.stack ?? project.tags).length > 0 && (
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: 8 }}>技术栈</div>
              <div className="flex flex-wrap gap-1.5">
                {(project.stack ?? project.tags).map((tech) => (
                  <span
                    key={tech}
                    style={{
                      padding: "2px 10px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: "#eef2ff",
                      color: "#4338ca",
                      border: "1px solid #e0e7ff",
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        className="max-w-6xl mx-auto px-7 flex flex-col"
        style={{ marginTop: 44, paddingBottom: 100, gap: 48 }}
      >
        {/* Overview */}
        {(project.overview || project.longDescription || project.description) && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 34, height: 34,
                  background: "#eef2ff",
                  borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "#111827" }}>
                项目概述
              </h2>
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                border: "1px solid #f3f4f6",
                boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                padding: "32px 36px",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  fontSize: 15,
                  lineHeight: 1.88,
                  color: "#4b5563",
                  whiteSpace: "pre-line",
                  margin: 0,
                }}
              >
                {project.overview || project.longDescription || project.description}
              </p>
            </div>
          </div>
        )}

        {/* Core Features */}
        {features.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 34, height: 34,
                  background: "#eef2ff",
                  borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Zap className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "#111827" }}>
                核心功能
              </h2>
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                border: "1px solid #f3f4f6",
                boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                padding: "4px 28px 4px 52px",
                position: "relative",
              }}
            >
              {isObjectFeatures ? (
                objectFeatures.map((feature, idx) => (
                  <FeatureCard
                    key={idx}
                    feature={feature}
                    index={idx}
                    isLast={idx === objectFeatures.length - 1}
                  />
                ))
              ) : (
                stringFeatures.map((feat, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 0",
                      borderBottom: idx < stringFeatures.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 14, color: "#374151" }}>
                      {feat}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Detail introduction */}
        {project.detail?.trim() && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 34, height: 34,
                  background: "#eef2ff",
                  borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "#111827" }}>
                详情介绍
              </h2>
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                border: "1px solid #f3f4f6",
                boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                padding: "32px 36px",
              }}
            >
              <MarkdownRenderer content={project.detail} className="prose-headings:scroll-mt-28" />
            </div>
          </div>
        )}

        {/* Next project */}
        {nextProject && nextProject.id !== project.id && (
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 40 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#9ca3af",
                marginBottom: 16,
              }}
            >
              Next Project
            </div>
            <Link
              to={`/portfolio/${nextProject.id}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                className="group"
                style={{
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "20px 24px",
                  borderRadius: 32,
                  border: "1px solid #f3f4f6",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateX(6px)";
                  el.style.borderColor = "#c7d2fe";
                  el.style.boxShadow = "0 8px 30px rgba(99,102,241,0.08)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "";
                  el.style.borderColor = "#f3f4f6";
                  el.style.boxShadow = "0 8px 30px rgba(0,0,0,0.04)";
                }}
              >
                {/* thumbnail */}
                <div
                  style={{
                    width: 64, height: 64,
                    borderRadius: 16,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={nextProject.imageUrl}
                    alt={nextProject.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div style={{ flex: 1 }}>
                  {nextProject.num && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                      Project {nextProject.num}
                    </div>
                  )}
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "#111827" }}>
                    {nextProject.title}
                  </div>
                </div>

                <ArrowRight
                  className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors"
                />
              </div>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
