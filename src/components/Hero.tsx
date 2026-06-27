import { motion } from "motion/react";
import { ArrowRight, Activity, Workflow, Layers, Sparkles } from "lucide-react";

const BAR_HEIGHTS = [38, 22, 44, 28, 58, 78, 48, 68, 38, 58, 88, 72, 42, 62, 84, 100];

function Seal({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 54,
        height: 54,
        borderRadius: 3,
        fontFamily: "var(--font-cn-serif)",
        fontWeight: 900,
        fontSize: 18,
        writingMode: "vertical-rl",
        textOrientation: "upright",
        letterSpacing: "0.1em",
        lineHeight: 1.2,
        transform: "rotate(-3deg)",
        flexShrink: 0,
        userSelect: "none",
        background: "linear-gradient(150deg, #ce4b39 0%, #b33326 100%)",
        color: "rgba(255,255,255,0.96)",
        border: "1.5px solid #922519",
        boxShadow:
          "inset 0 0 0 3px rgba(255,255,255,0.42), inset 0 0 0 4.5px rgba(255,255,255,0.12), 0 4px 16px rgba(166,49,31,0.55), 0 1px 3px rgba(0,0,0,0.18)",
      }}
    >
      {children}
    </span>
  );
}

export function Hero() {
  return (
    <section
      style={{ background: "linear-gradient(170deg, var(--paper) 0%, #fafafa 55%)" }}
      className="relative overflow-hidden"
    >
      {/* Dot grid overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.32] pointer-events-none" />
      {/* Indigo blur circle */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "15%",
          right: "20%",
          width: 480,
          height: 480,
          background: "#e0e7ff",
          filter: "blur(120px)",
          opacity: 0.45,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-7 grid items-center gap-14 lg:gap-14"
        style={{ gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.92fr)", minHeight: "calc(100dvh - 80px)", paddingTop: 48, paddingBottom: 48 }}
      >
        {/* LEFT */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Seal + Status */}
          <div className="flex items-center gap-3.5 mb-8">
            <Seal>几许</Seal>
            <span
              className="inline-flex items-center gap-2"
              style={{
                height: 30,
                padding: "5px 12px",
                borderRadius: 9999,
                background: "#fff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "#4b5563",
              }}
            >
              <span className="relative inline-flex w-2.5 h-2.5">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "#10b981",
                    opacity: 0.7,
                    animation: "jx-ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                />
                <span className="relative w-2.5 h-2.5 rounded-full" style={{ background: "#10b981" }} />
              </span>
              Available for new opportunities
            </span>
          </div>

          {/* Verse */}
          <h1
            style={{
              fontFamily: "var(--font-cn-brush)",
              fontSize: 58,
              lineHeight: 1.13,
              color: "var(--ink)",
              margin: "0 0 8px",
              letterSpacing: "0.02em",
              fontWeight: 400,
            }}
          >
            且将新火试新茶，<br />诗酒趁年华。
          </h1>

          {/* Attribution */}
          <div className="flex items-center gap-2.5 mb-7" style={{ marginTop: 10 }}>
            <span className="block h-px w-6" style={{ background: "var(--seal)", opacity: 0.55 }} />
            <span
              style={{
                fontFamily: "var(--font-cn-serif)",
                fontSize: 13,
                color: "var(--seal)",
                letterSpacing: "0.05em",
              }}
            >
              苏轼《望江南·超然台作》
            </span>
          </div>

          {/* Body copy */}
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              fontWeight: 500,
              lineHeight: 1.85,
              color: "#4b5563",
              maxWidth: 440,
              margin: "0 0 34px",
            }}
          >
            于无声处，建一座城。一个在代码里造世界的人。
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 mb-7">
            <a
              href="#projects"
              className="inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-95"
              style={{
                height: 48,
                padding: "0 24px",
                borderRadius: 9999,
                background: "#111827",
                color: "#fff",
                fontSize: 15,
                textDecoration: "none",
                transition: "all 0.25s var(--ease-signature)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#4f46e5";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 30px rgba(99,102,241,0.30)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#111827";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              查看作品 <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#experience"
              className="inline-flex items-center justify-center font-semibold transition-all active:scale-95"
              style={{
                height: 48,
                padding: "0 24px",
                borderRadius: 9999,
                background: "#fff",
                color: "#111827",
                border: "1px solid #e5e7eb",
                fontSize: 15,
                textDecoration: "none",
                transition: "all 0.25s var(--ease-signature)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
            >
              工作经历
            </a>
          </div>

          {/* Tech tags */}
          <div className="flex flex-wrap gap-2">
            {(["Golang", "Kafka", "Redis", "分布式系统"] as const).map((tag, i) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: i === 0 ? "#eef2ff" : "#f9fafb",
                  border: `1px solid ${i === 0 ? "#e0e7ff" : "#f3f4f6"}`,
                  color: i === 0 ? "#4338ca" : "#4b5563",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — Bento */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 gap-3.5 mt-8 lg:mt-0"
        >
          {/* System Traffic — spans 2 cols */}
          <div
            className="col-span-2"
            style={{
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(12px)",
              border: "1px solid #f3f4f6",
              borderRadius: 32,
              padding: "22px 24px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="flex items-center gap-1.5 m-0" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "#111827" }}>
                  <Activity className="w-[17px] h-[17px] text-indigo-500" />
                  System Traffic
                </h3>
                <p className="mt-0.5 m-0" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6b7280" }}>requests / second</p>
              </div>
              <div
                className="flex items-baseline gap-0.5"
                style={{
                  color: "#4f46e5",
                  background: "#eef2ff",
                  border: "1px solid #e0e7ff",
                  padding: "5px 12px",
                  borderRadius: 16,
                }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>12k</span>
                <span style={{ fontWeight: 700, fontSize: 11 }}>/s</span>
              </div>
            </div>
            {/* Bar chart */}
            <div className="flex items-end pb-1.5 border-b border-gray-100" style={{ height: 76, gap: 3.5 }}>
              {BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    borderRadius: "3px 3px 0 0",
                    transformOrigin: "bottom",
                    background: i > 11
                      ? "linear-gradient(to top, #6366f1, #a855f7)"
                      : "#e0e7ff",
                    animation: `jx-bar 1.7s ${i * 0.09}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Event Streams */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #f3f4f6",
              borderRadius: 32,
              padding: 18,
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center gap-2.5 mb-3.5">
              <div
                style={{
                  width: 34, height: 34,
                  background: "#fff7ed",
                  border: "1px solid #ffedd5",
                  borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Workflow className="w-[17px] h-[17px] text-orange-500" />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#111827" }}>消息队列</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>Event Streams</div>
              </div>
            </div>

            {[
              { label: "Topic A", color: "#f97316", delay: "0s" },
              { label: "Topic B", color: "#6366f1", delay: "0.7s" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-1.5 mb-1.5">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9ca3af", width: 40, textAlign: "right" }}>{row.label}</span>
                <div className="flex-1 relative overflow-hidden" style={{ height: 18, background: "#f9fafb", borderRadius: 4 }}>
                  <div
                    style={{
                      position: "absolute",
                      top: 2, width: 13, height: 13,
                      borderRadius: 3,
                      background: row.color,
                      opacity: 0.4,
                      animation: `jx-stream 1.9s ${row.delay} linear infinite`,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center gap-1.5">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9ca3af", width: 40, textAlign: "right" }}>DLQ</span>
              <div className="flex items-center gap-1 pl-1" style={{ flex: 1, height: 18, background: "#f9fafb", borderRadius: 4 }}>
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: "#fda4af" }} />
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: "#fda4af" }} />
              </div>
            </div>
          </div>

          {/* Vector Embeddings */}
          <div
            className="relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7, #d946ef)",
              borderRadius: 32,
              padding: 18,
              boxShadow: "0 20px 40px rgba(168,85,247,0.20)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')",
                opacity: 0.07,
                mixBlendMode: "overlay",
              }}
            />
            <div className="relative">
              <div className="flex justify-between items-start mb-2.5">
                <div
                  style={{
                    width: 34, height: 34,
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Layers className="w-[17px] h-[17px] text-white" />
                </div>
                <span
                  className="inline-flex items-center gap-0.5"
                  style={{
                    padding: "2px 8px",
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 9999,
                    fontWeight: 700,
                    fontSize: 9,
                    color: "#fff",
                  }}
                >
                  <Sparkles className="w-2 h-2 text-fuchsia-300" /> AI
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 2 }}>向量检索</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "#e0e7ff", marginBottom: 10 }}>Vector Embeddings</div>
              <div
                style={{
                  background: "rgba(0,0,0,0.22)",
                  borderRadius: 12,
                  padding: 9,
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  color: "#e0e7ff",
                  display: "flex", flexDirection: "column", gap: 5,
                }}
              >
                <div className="flex justify-between"><span style={{ opacity: 0.7 }}>Dim</span><span className="font-bold text-white">1536</span></div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
                <div className="flex gap-0.5">
                  <span style={{ color: "#34d399" }}>[0.84</span>
                  <span>-0.11</span>
                  <span style={{ color: "#34d399" }}>0.99]</span>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
                <div className="flex justify-between"><span style={{ opacity: 0.7 }}>Score</span><span style={{ color: "#f0abfc", fontWeight: 700 }}>0.982</span></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
