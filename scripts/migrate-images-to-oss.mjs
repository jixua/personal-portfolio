import fs from "node:fs";
import path from "node:path";
import OSS from "ali-oss";
import Database from "better-sqlite3";

const required = [
  "ALI_OSS_ACCESS_KEY_ID",
  "ALI_OSS_ACCESS_KEY_SECRET",
  "ALI_OSS_BUCKET",
  "ALI_OSS_REGION",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
}

const bucket = process.env.ALI_OSS_BUCKET;
const region = process.env.ALI_OSS_REGION;
const prefixRoot = (process.env.ALI_OSS_MIGRATE_PREFIX || "jixu/portfolio").replace(/^\/+|\/+$/g, "");
const publicBaseUrl = (process.env.ALI_OSS_PUBLIC_BASE_URL || `https://${bucket}.${region}.aliyuncs.com`).replace(/\/+$/g, "");
const dryRun = process.argv.includes("--dry-run");

const client = new OSS({
  accessKeyId: process.env.ALI_OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALI_OSS_ACCESS_KEY_SECRET,
  bucket,
  region,
  endpoint: process.env.ALI_OSS_ENDPOINT || undefined,
});

const db = new Database("data/database.sqlite");
try {
  db.exec("ALTER TABLE projects ADD COLUMN thumbnailUrl TEXT");
} catch {}

const projects = db.prepare("SELECT id, imageUrl, thumbnailUrl FROM projects").all();
const coverOriginals = new Set();
const coverThumbs = new Set();

for (const project of projects) {
  if (typeof project.imageUrl === "string" && project.imageUrl.startsWith("/uploads/")) {
    coverOriginals.add(path.basename(project.imageUrl));
  }
  if (typeof project.thumbnailUrl === "string" && project.thumbnailUrl.startsWith("/uploads/")) {
    coverThumbs.add(path.basename(project.thumbnailUrl));
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => !name.startsWith(".") && fs.statSync(path.join(dir, name)).isFile())
    .map((name) => path.join(dir, name));
}

function objectKeyFor(localPath) {
  const name = path.basename(localPath);
  if (localPath.startsWith(`uploads${path.sep}`)) {
    if (coverThumbs.has(name)) return `${prefixRoot}/projects/covers/thumbs/${name}`;
    if (coverOriginals.has(name)) return `${prefixRoot}/projects/covers/original/${name}`;
    return `${prefixRoot}/uploads/${name}`;
  }
  if (localPath.startsWith(`public${path.sep}`)) return `${prefixRoot}/public/${name}`;
  return `${prefixRoot}/misc/${name}`;
}

function publicUrlFor(objectKey) {
  return `${publicBaseUrl}/${objectKey}`;
}

async function upload(localPath) {
  const objectKey = objectKeyFor(localPath);
  const url = publicUrlFor(objectKey);
  if (dryRun) {
    console.log(`[dry-run] ${localPath} -> ${objectKey}`);
    return { localPath, objectKey, url };
  }
  await client.put(objectKey, localPath, {
    headers: {
      ...(process.env.ALI_OSS_OBJECT_ACL ? { "x-oss-object-acl": process.env.ALI_OSS_OBJECT_ACL } : {}),
    },
  });
  console.log(`${localPath} -> ${url}`);
  return { localPath, objectKey, url };
}

const files = [...listFiles("uploads"), ...listFiles("public")]
  .filter((file) => /\.(png|jpe?g|webp|gif|svg)$/i.test(file));

const uploaded = [];
for (const file of files) {
  uploaded.push(await upload(file));
}

const urlByUploadPath = new Map();
for (const item of uploaded) {
  if (item.localPath.startsWith(`uploads${path.sep}`)) {
    urlByUploadPath.set(`/uploads/${path.basename(item.localPath)}`, item.url);
  }
}

if (!dryRun) {
  const updateProject = db.prepare("UPDATE projects SET imageUrl = ?, thumbnailUrl = ? WHERE id = ?");
  const updateText = db.prepare("UPDATE projects SET description = ?, longDescription = ?, overview = ?, detail = ?, features = ? WHERE id = ?");
  const textProjects = db.prepare("SELECT id, description, longDescription, overview, detail, features FROM projects").all();

  const tx = db.transaction(() => {
    for (const project of projects) {
      const imageUrl = urlByUploadPath.get(project.imageUrl) || project.imageUrl;
      const thumbnailUrl = urlByUploadPath.get(project.thumbnailUrl) || project.thumbnailUrl;
      updateProject.run(imageUrl, thumbnailUrl, project.id);
    }

    for (const project of textProjects) {
      const fields = ["description", "longDescription", "overview", "detail", "features"].map((field) => {
        let value = project[field];
        if (typeof value !== "string") return value;
        for (const [from, to] of urlByUploadPath) value = value.split(from).join(to);
        return value;
      });
      updateText.run(...fields, project.id);
    }
  });
  tx();
  console.log(`Updated SQLite references for ${urlByUploadPath.size} upload objects.`);
}
