export function safeParseArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function commaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function getClipboardImageFiles(clipboardData: DataTransfer) {
  const directFiles = Array.from(clipboardData.files).filter((file) => file.type.startsWith("image/"));
  if (directFiles.length > 0) return directFiles;
  return Array.from(clipboardData.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

export function getImageAltText(file: File, index: number) {
  if (!file.name) return `clipboard-image-${index + 1}`;
  return file.name.replace(/\.[^.]+$/, "") || `clipboard-image-${index + 1}`;
}

function isRemoteOrRootPath(src: string) {
  return /^(https?:)?\/\//i.test(src) || src.startsWith("data:") || src.startsWith("/") || src.startsWith("#");
}

function normalizeAssetPath(path: string) {
  return decodeURIComponent(path).replace(/\\/g, "/").replace(/^(\.\/)+/, "").trim();
}

function normalizeRelativePath(path: string) {
  const parts: string[] = [];
  for (const part of normalizeAssetPath(path).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function getFileRelativePath(file: File) {
  return normalizeRelativePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
}

function getDirname(path: string) {
  const normalized = normalizeRelativePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function joinRelativePath(baseDir: string, targetPath: string) {
  return normalizeRelativePath(baseDir ? `${baseDir}/${targetPath}` : targetPath);
}

function assetFileName(path: string) {
  const normalized = normalizeAssetPath(path);
  return normalized.split("/").pop() || normalized;
}

export function extractMarkdownImagePaths(markdown: string) {
  const paths = new Set<string>();
  const patterns = [
    /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    /!\[\[([^\]|]+)(?:\|[^\]]*)?]]/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(markdown))) {
      const src = match[1].trim();
      if (!isRemoteOrRootPath(src)) paths.add(src);
    }
  }
  return Array.from(paths);
}

export function replaceMarkdownAssetPath(markdown: string, originalPath: string, uploadedUrl: string) {
  const escaped = originalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alt = assetFileName(originalPath).replace(/\.[^.]+$/, "") || "图片";
  return markdown
    .replace(new RegExp(`!\\[\\[${escaped}(?:\\|([^\\]]*))?]]`, "g"), (_match, label) => `![${label || alt}](${uploadedUrl})`)
    .replace(new RegExp(escaped, "g"), uploadedUrl);
}

export function findMarkdownAssetFile(imageFiles: File[], markdownFile: File, imagePath: string) {
  const byRelativePath = new Map(imageFiles.map((file) => [getFileRelativePath(file), file]));
  const byName = new Map(imageFiles.map((file) => [file.name, file]));
  const markdownDir = getDirname(getFileRelativePath(markdownFile));
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

