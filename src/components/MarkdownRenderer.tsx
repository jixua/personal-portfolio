import React, { useEffect, useId, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";
import { Check, Copy, Link2, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { extractMarkdownHeadings, parseMarkdownContent, slugifyMarkdownHeading } from "../lib/markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showFrontmatter?: boolean;
  editableTables?: {
    onAddColumn: (tableIndex: number) => void;
    onAddRow: (tableIndex: number) => void;
  };
}

type MarkdownNodeWithPosition = {
  position?: {
    start?: {
      line?: number;
    };
  };
};

type MediaPreviewContent =
  | {
      type: "html";
      html: string;
      label: string;
    }
  | {
      type: "image";
      src: string;
      alt: string;
    };

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ["target"], ["rel"]],
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./, "math-inline", "math-display"]],
    div: [...(defaultSchema.attributes?.div ?? []), ["className"]],
    input: [...(defaultSchema.attributes?.input ?? []), ["checked", true], ["disabled", true], ["type", "checkbox"]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className"], ["aria-hidden"]],
  },
};

let mermaidInstance: Awaited<typeof import("mermaid")>["default"] | null = null;
let mermaidRenderCounter = 0;

async function getMermaidInstance() {
  if (mermaidInstance) return mermaidInstance;

  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  });
  mermaidInstance = mermaid;
  return mermaid;
}

const headingSizeClasses: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-3xl md:text-4xl mt-0 mb-8",
  2: "text-2xl md:text-3xl mt-12 mb-5 border-b border-gray-100 pb-3",
  3: "text-xl md:text-2xl mt-10 mb-4",
  4: "text-lg md:text-xl mt-8 mb-3",
  5: "text-base md:text-lg mt-6 mb-2",
  6: "text-sm md:text-base mt-6 mb-2 uppercase text-gray-500",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(children)) return extractText(children.props.children);
  return "";
}

function getPlainTextChildren(children: React.ReactNode): string | null {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    const parts = children.map(getPlainTextChildren);
    return parts.every((part): part is string => part !== null) ? parts.join("") : null;
  }
  return null;
}

function isExternalHref(href?: string) {
  return Boolean(href && /^(https?:)?\/\//.test(href));
}

function getCodeElement(children: React.ReactNode): React.ReactElement<ComponentPropsWithoutRef<"code">> | null {
  const [firstChild] = React.Children.toArray(children);
  return React.isValidElement<ComponentPropsWithoutRef<"code">>(firstChild) ? firstChild : null;
}

function getCodeLanguage(className?: string) {
  return /language-([\w-]+)/.exec(className || "")?.[1] ?? "text";
}

function formatCodeLanguage(language: string) {
  return language === "text" ? "TEXT" : language.toUpperCase();
}

function CopyButton({ text, title = "复制代码" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
      title={title}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="not-prose group my-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
      <div className="flex h-[50px] items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-[18px]">
        <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">
          {formatCodeLanguage(language)}
        </span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        style={oneLight as Record<string, React.CSSProperties>}
        language={language}
        PreTag="div"
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          padding: "1rem 18px",
          background: "#fbfdff",
          fontSize: "15px",
          lineHeight: "1.7rem",
          overflowX: "auto",
          borderRadius: 0,
        }}
        codeTagProps={{
          style: {
            fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            color: "#0f172a",
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MediaPreviewOverlay({
  content,
  onClose,
}: {
  content: MediaPreviewContent;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const updateZoom = (nextZoom: number) => {
    setZoom(Math.min(4, Math.max(0.25, Number(nextZoom.toFixed(2)))));
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    updateZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
  };

  const zoomStyle = { zoom } as React.CSSProperties;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={content.type === "html" ? `${content.label} 预览` : content.alt || "图片预览"}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-5 top-5 z-[102] inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-colors hover:bg-black"
        title="关闭"
        aria-label="关闭预览"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="flex h-full w-full items-center justify-center overflow-auto p-5 sm:p-8" onWheel={handlePreviewWheel}>
        <div className="min-h-full min-w-full py-8">
          <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
            {content.type === "html" ? (
              <div
                className="inline-block max-w-none bg-white text-slate-900 shadow-2xl"
                style={zoomStyle}
                onClick={(event) => event.stopPropagation()}
                dangerouslySetInnerHTML={{ __html: content.html }}
              />
            ) : (
              <img
                src={content.src}
                alt={content.alt}
                className="block max-h-[calc(100vh-8rem)] max-w-[min(92vw,1400px)] bg-white object-contain shadow-2xl"
                style={zoomStyle}
                onClick={(event) => event.stopPropagation()}
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-5 left-1/2 z-[102] flex -translate-x-1/2 items-center gap-2 rounded-md bg-black/80 px-3 py-2 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateZoom(zoom - 0.2);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white transition-colors hover:bg-white/15"
          title="缩小"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-12 text-center font-mono text-sm">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateZoom(zoom + 0.2);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white transition-colors hover:bg-white/15"
          title="放大"
        >
          <Plus className="h-4 w-4" />
        </button>
        <span className="h-5 w-px bg-white/25" />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateZoom(1);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white transition-colors hover:bg-white/15"
          title="重置缩放"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MermaidBlock({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      try {
        const mermaid = await getMermaidInstance();
        setError(null);
        setSvg("");

        const safeId = reactId.replace(/[^a-zA-Z0-9_-]/g, "");
        mermaidRenderCounter += 1;
        const { svg: renderedSvg } = await mermaid.render(`markdown-mermaid-${safeId}-${mermaidRenderCounter}`, code);
        if (!cancelled) setSvg(renderedSvg);
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Mermaid 图表渲染失败");
        }
      }
    }

    renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  const openPreview = () => {
    if (!svg) return;
    setIsPreviewOpen(true);
  };

  return (
    <>
      <div className="not-prose group my-5 w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
        <div className="flex h-[50px] items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-[18px]">
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">MERMAID</span>
          <div className="flex items-center gap-1">
            {svg && !error && (
              <button
                type="button"
                onClick={openPreview}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                title="放大查看图表"
              >
                <Maximize2 className="h-4 w-4" />
                放大
              </button>
            )}
            <CopyButton text={code} />
          </div>
        </div>
        <div className="overflow-x-auto bg-white p-5">
          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <p className="m-0 text-sm font-semibold text-red-700">Mermaid 图表语法无法渲染</p>
              <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-red-600">{error}</p>
            </div>
          ) : svg ? (
            <button
              type="button"
              onClick={openPreview}
              className="mermaid-rendered flex w-full cursor-zoom-in justify-center rounded-lg p-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 [&>svg]:mx-auto"
              title="点击放大查看图表"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="text-sm font-medium text-slate-400">正在渲染图表...</div>
          )}
        </div>
      </div>

      {isPreviewOpen && svg && (
        <MediaPreviewOverlay content={{ type: "html", html: svg, label: "Mermaid 图表" }} onClose={() => setIsPreviewOpen(false)} />
      )}
    </>
  );
}

function MarkdownImage({ className, alt, src, ...props }: ComponentPropsWithoutRef<"img">) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const imageSrc = typeof src === "string" ? src : "";
  const imageAlt = alt ?? "";

  if (!imageSrc) {
    return <img className={cx("mx-auto rounded-xl border border-gray-100 shadow-sm", className)} alt={imageAlt} src={src} loading="lazy" {...props} />;
  }

  return (
    <>
      <button type="button" className="not-prose my-8 block w-full cursor-zoom-in" onClick={() => setIsPreviewOpen(true)} title="点击放大查看图片">
        <img className={cx("mx-auto rounded-xl border border-gray-100 shadow-sm", className)} alt={imageAlt} src={imageSrc} loading="lazy" {...props} />
      </button>
      {isPreviewOpen && <MediaPreviewOverlay content={{ type: "image", src: imageSrc, alt: imageAlt }} onClose={() => setIsPreviewOpen(false)} />}
    </>
  );
}

function PreRenderer({ children }: ComponentPropsWithoutRef<"pre">) {
  const codeElement = getCodeElement(children);
  if (!codeElement) return <pre>{children}</pre>;

  const code = extractText(codeElement.props.children).replace(/\n$/, "");
  const language = getCodeLanguage(codeElement.props.className);

  if (language === "mermaid") return <MermaidBlock code={code} />;

  return <CodeBlock code={code} language={language} />;
}

function CodeRenderer({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
  if (className?.includes("language-")) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <code
      className={cx(
        "rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-[0.12rem] font-mono text-[0.86em] font-semibold text-indigo-700 before:content-none after:content-none",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}

function HeadingRenderer({
  level,
  getHeadingId,
  node,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"h1"> & {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  getHeadingId: (text: string, node?: MarkdownNodeWithPosition) => string;
  node?: MarkdownNodeWithPosition;
}) {
  const text = extractText(children);
  const id = getHeadingId(text, node);
  const Tag = `h${level}` as React.ElementType<ComponentPropsWithoutRef<"h1">>;

  return (
    <Tag id={id} className={cx("group relative scroll-mt-24 font-display font-black tracking-tight text-gray-900", headingSizeClasses[level], className)} {...props}>
      <a
        href={`#${id}`}
        className="not-prose absolute -left-8 top-1/2 hidden -translate-y-1/2 text-gray-300 opacity-0 transition-opacity hover:text-indigo-500 group-hover:opacity-100 sm:block"
        aria-label={`${text} permalink`}
      >
        <Link2 className="h-4 w-4" />
      </a>
      {children}
    </Tag>
  );
}

function TableCellContent({ children }: { children: React.ReactNode }) {
  const plainText = getPlainTextChildren(children);
  if (!plainText) return <>{children}</>;

  return <>{children}</>;
}

function FrontmatterBlock({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="not-prose mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <dl className="grid gap-3 sm:grid-cols-[120px_1fr]">
        {entries.map(([key, value]) => (
          <React.Fragment key={key}>
            <dt className="font-mono text-xs font-bold uppercase tracking-widest text-gray-400">{key}</dt>
            <dd className="break-words text-sm font-medium text-gray-700">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

export function MarkdownRenderer({ content, className, showFrontmatter = false, editableTables }: MarkdownRendererProps) {
  const parsed = useMemo(() => parseMarkdownContent(content), [content]);
  const headingIdByLine = useMemo(() => {
    return new Map(extractMarkdownHeadings(parsed.content).map((heading) => [heading.line, heading.id]));
  }, [parsed.content]);
  let tableIndex = 0;

  const getHeadingId = (text: string, node?: MarkdownNodeWithPosition) => {
    const line = node?.position?.start?.line;
    if (line) return headingIdByLine.get(line) ?? slugifyMarkdownHeading(text);
    return slugifyMarkdownHeading(text);
  };

  const components: Components = {
    code: CodeRenderer as Components["code"],
    pre: PreRenderer as Components["pre"],
    h1: (props) => <HeadingRenderer level={1} getHeadingId={getHeadingId} {...props} />,
    h2: (props) => <HeadingRenderer level={2} getHeadingId={getHeadingId} {...props} />,
    h3: (props) => <HeadingRenderer level={3} getHeadingId={getHeadingId} {...props} />,
    h4: (props) => <HeadingRenderer level={4} getHeadingId={getHeadingId} {...props} />,
    h5: (props) => <HeadingRenderer level={5} getHeadingId={getHeadingId} {...props} />,
    h6: (props) => <HeadingRenderer level={6} getHeadingId={getHeadingId} {...props} />,
    a: ({ node: _node, href, className: linkClassName, ...props }) => (
      <a
        href={href}
        target={isExternalHref(href) ? "_blank" : undefined}
        rel={isExternalHref(href) ? "noopener noreferrer" : undefined}
        className={cx("underline-offset-4", linkClassName)}
        {...props}
      />
    ),
    blockquote: ({ node: _node, className: quoteClassName, ...props }) => (
      <blockquote
        className={cx(
          "not-prose my-6 border-l-4 border-indigo-300 bg-indigo-50/60 py-3 pl-5 pr-4 text-gray-700 [&_p]:my-0 [&_p]:leading-8",
          quoteClassName,
        )}
        {...props}
      />
    ),
    img: ({ node: _node, className: imageClassName, alt, ...props }) => <MarkdownImage className={imageClassName} alt={alt ?? ""} {...props} />,
    input: ({ node: _node, className: inputClassName, ...props }) => (
      <input className={cx("mr-2 translate-y-[1px] accent-indigo-600", inputClassName)} readOnly {...props} />
    ),
    table: ({ node: _node, className: tableClassName, ...props }) => {
      const currentTableIndex = tableIndex;
      tableIndex += 1;

      return (
        <div className={cx("not-prose my-8 rounded-xl border border-gray-200", editableTables ? "admin-preview-table-wrap" : "overflow-x-auto")}>
          <div className={editableTables ? "overflow-x-auto rounded-xl" : undefined}>
            <table className={cx("w-full border-collapse text-sm", tableClassName)} {...props} />
          </div>
          {editableTables && (
            <>
              <button
                type="button"
                className="md-table-add md-table-add-col"
                onClick={() => editableTables.onAddColumn(currentTableIndex)}
                aria-label="在右方新增列"
                title="在右方新增列"
              >
                +
              </button>
              <button
                type="button"
                className="md-table-add md-table-add-row"
                onClick={() => editableTables.onAddRow(currentTableIndex)}
                aria-label="在下方新增行"
                title="在下方新增行"
              >
                +
              </button>
            </>
          )}
        </div>
      );
    },
    th: ({ node: _node, className: thClassName, children, ...props }) => (
      <th className={cx("border-b border-gray-200 bg-gray-50 px-4 py-3 text-left font-bold text-gray-900", thClassName)} {...props}>
        <TableCellContent>{children}</TableCellContent>
      </th>
    ),
    td: ({ node: _node, className: tdClassName, children, ...props }) => (
      <td className={cx("border-b border-gray-100 px-4 py-3 align-top text-gray-700 last:border-b-0", tdClassName)} {...props}>
        <TableCellContent>{children}</TableCellContent>
      </td>
    ),
  };

  return (
    <div
      className={cx(
        "markdown-body prose prose-lg prose-slate max-w-none break-words",
        "prose-p:leading-8 prose-p:text-gray-700",
        "prose-li:text-gray-700 prose-li:leading-8",
        "prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline",
        "prose-strong:font-extrabold prose-strong:text-gray-900",
        "prose-hr:border-gray-100 prose-img:my-8",
        className,
      )}
    >
      {showFrontmatter && <FrontmatterBlock data={parsed.frontmatter} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={components}
      >
        {parsed.content}
      </ReactMarkdown>
    </div>
  );
}
