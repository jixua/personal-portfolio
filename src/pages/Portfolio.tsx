import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, LayoutTemplate } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import type { Project } from "../data";

type Category = "All" | "Backend" | "Full Stack";

function WorkProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/portfolio/${project.id}`}
        style={{ textDecoration: "none", display: "block" }}
        className="group"
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 32,
            border: "1px solid #f3f4f6",
            boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            overflow: "hidden",
            transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "translateY(-5px)";
            el.style.borderColor = "#c7d2fe";
            el.style.boxShadow = "0 8px 30px rgba(99,102,241,0.08), 0 10px 30px rgba(99,102,241,0.08)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "";
            el.style.borderColor = "#f3f4f6";
            el.style.boxShadow = "0 8px 30px rgba(0,0,0,0.04)";
          }}
        >
          {/* Image area */}
          <div className="relative overflow-hidden" style={{ height: 220 }}>
            <img
              src={project.thumbnailUrl || project.imageUrl}
              alt={project.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              loading={index < 2 ? "eager" : "lazy"}
              decoding="async"
            />
            {/* gradient overlay */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)" }}
            />
            {/* tech tag pills bottom-left */}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              {project.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.9)",
                    color: "#4338ca",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            {/* project number top-right */}
            {project.num && (
              <div
                className="absolute top-3 right-3"
                style={{
                  padding: "3px 9px",
                  borderRadius: 9999,
                  background: "rgba(0,0,0,0.38)",
                  backdropFilter: "blur(8px)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {project.num}
              </div>
            )}
          </div>

          {/* Content area */}
          <div style={{ padding: "24px 28px 28px" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              {project.category ?? "Project"} {project.period ? `· ${project.period}` : ""}
            </div>

            <h3
              className="group-hover:text-indigo-600 transition-colors"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 20,
                lineHeight: 1.25,
                color: "#111827",
                marginBottom: 10,
              }}
            >
              {project.title}
            </h3>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.55,
                color: "#24315f",
                marginBottom: 20,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {project.description}
            </p>

            <div
              style={{
                borderTop: "1px solid #f3f4f6",
                paddingTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="flex flex-wrap gap-1.5">
                {(project.stack ?? project.tags).slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "2px 10px",
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#eef2ff",
                      color: "#4338ca",
                      border: "1px solid #e0e7ff",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <span
                className="flex items-center gap-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  transition: "color 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                探索项目 <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function Portfolio() {
  const { projects } = useData();
  const [activeFilter, setActiveFilter] = useState<Category>("All");

  const filtered = activeFilter === "All"
    ? projects
    : projects.filter((p) => p.category === activeFilter);

  const filters: Category[] = ["All", "Backend", "Full Stack"];

  return (
    <div className="min-h-screen bg-[#fafafa] pt-20">
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(170deg, #faf7f1 0%, #fafafa 60%)",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <div className="max-w-6xl mx-auto px-7" style={{ paddingTop: 48, paddingBottom: 60 }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: "linear-gradient(135deg, #6366f1, #a855f7)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-white" />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#4f46e5",
                }}
              >
                Portfolio
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#9ca3af",
                }}
              >
                — {projects.length} Projects
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(2.5rem,6vw,3.25rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#111827",
                marginBottom: 20,
              }}
            >
              我的作品集
            </h1>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 17,
                fontWeight: 500,
                lineHeight: 1.65,
                color: "#4b5563",
                maxWidth: 560,
                marginBottom: 36,
              }}
            >
              这里展示了我参与或主导的核心系统项目。每个项目都包含完整的业务思考、架构设计与最终落地成果。
            </p>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  style={{
                    height: 36,
                    padding: "0 18px",
                    borderRadius: 9999,
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "1px solid",
                    transition: "all 0.2s",
                    background: activeFilter === f ? "#111827" : "#fff",
                    color: activeFilter === f ? "#fff" : "#374151",
                    borderColor: activeFilter === f ? "#111827" : "#e5e7eb",
                  }}
                >
                  {f === "All" ? "全部" : f}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-7" style={{ paddingTop: 48, paddingBottom: 80 }}>
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400" style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>
            暂无此分类的项目
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))",
              gap: 24,
            }}
          >
            {filtered.map((project, idx) => (
              <WorkProjectCard key={project.id} project={project} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
