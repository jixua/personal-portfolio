import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import multer from "multer";
import { knowledgeDocs } from "./src/data";

// Create /data dir if it doesn't exist
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create /uploads dir if it doesn't exist
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Database Setup
const sqlite = new Database(path.join(dataDir, "database.sqlite"));

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    longDescription TEXT,
    features TEXT,
    tags TEXT,
    imageUrl TEXT,
    link TEXT,
    github TEXT
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    snippet TEXT,
    date TEXT,
    readTime TEXT,
    content TEXT
  );
  CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parentId INTEGER,
    title TEXT NOT NULL,
    isFolder INTEGER NOT NULL DEFAULT 0,
    content TEXT
  );
  CREATE TABLE IF NOT EXISTS experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT,
    date TEXT,
    description TEXT,
    achievements TEXT,
    techStack TEXT
  );
`);

// Migrations for existing databases
const projectMigrations = [
  "ALTER TABLE projects ADD COLUMN longDescription TEXT",
  "ALTER TABLE projects ADD COLUMN features TEXT",
  "ALTER TABLE projects ADD COLUMN tags TEXT",
  "ALTER TABLE projects ADD COLUMN link TEXT",
  "ALTER TABLE projects ADD COLUMN github TEXT",
  "ALTER TABLE posts ADD COLUMN snippet TEXT",
  "ALTER TABLE projects ADD COLUMN num TEXT",
  "ALTER TABLE projects ADD COLUMN subtitle TEXT",
  "ALTER TABLE projects ADD COLUMN category TEXT",
  "ALTER TABLE projects ADD COLUMN role TEXT",
  "ALTER TABLE projects ADD COLUMN period TEXT",
  "ALTER TABLE projects ADD COLUMN overview TEXT",
  "ALTER TABLE projects ADD COLUMN stack TEXT",
  "ALTER TABLE projects ADD COLUMN sortOrder INTEGER",
  "ALTER TABLE posts ADD COLUMN sortOrder INTEGER",
  "ALTER TABLE docs ADD COLUMN sortOrder INTEGER",
];
for (const sql of projectMigrations) {
  try { sqlite.exec(sql); } catch {}
}

sqlite.exec(`
  UPDATE projects SET sortOrder = id WHERE sortOrder IS NULL;
  UPDATE posts SET sortOrder = id WHERE sortOrder IS NULL;
  UPDATE docs SET sortOrder = id WHERE sortOrder IS NULL;
`);

// 首次启动时，把 data.ts 中的静态面经数据种入 docs 表，方便后台直接管理
function seedDocs() {
  const row = sqlite.prepare("SELECT COUNT(*) AS c FROM docs").get() as { c: number };
  if (row.c > 0) return;
  const insert = sqlite.prepare(
    "INSERT INTO docs (parentId, title, isFolder, content, sortOrder) VALUES (?, ?, ?, ?, ?)"
  );
  const walk = (nodes: typeof knowledgeDocs, parentId: number | null) => {
    nodes.forEach((n, index) => {
      const info = insert.run(parentId, n.title, n.isFolder ? 1 : 0, n.content ?? null, index + 1);
      if (n.children && n.children.length > 0) {
        walk(n.children, Number(info.lastInsertRowid));
      }
    });
  };
  const seedAll = sqlite.transaction(() => walk(knowledgeDocs, null));
  seedAll();
}
seedDocs();

// 把扁平的 docs 行组装成嵌套树（id 转为 string 以匹配前端 DocNode）
function buildDocTree(parentId: number | null): any[] {
  const rows = (parentId === null
    ? sqlite.prepare("SELECT * FROM docs WHERE parentId IS NULL ORDER BY sortOrder, id").all()
    : sqlite.prepare("SELECT * FROM docs WHERE parentId = ? ORDER BY sortOrder, id").all(parentId)
  ) as any[];
  return rows.map((r) => ({
    id: String(r.id),
    sortOrder: r.sortOrder ?? undefined,
    title: r.title,
    isFolder: !!r.isFolder,
    content: r.content ?? undefined,
    children: r.isFolder ? buildDocTree(r.id) : undefined,
  }));
}

// 递归删除某个节点及其全部子节点
function deleteDocRecursive(id: number) {
  const children = sqlite.prepare("SELECT id FROM docs WHERE parentId = ?").all(id) as { id: number }[];
  for (const c of children) deleteDocRecursive(c.id);
  sqlite.prepare("DELETE FROM docs WHERE id = ?").run(id);
}

// 预置唯一管理员账号，并清理其他历史账号（注册已关闭，仅此账号可登录）
// 可通过环境变量 ADMIN_EMAIL / ADMIN_PASSWORD 覆盖默认值
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "jixu0090@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "jixu201421";
function seedAdmin() {
  sqlite.prepare("DELETE FROM users WHERE email != ?").run(ADMIN_EMAIL);
  const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_EMAIL);
  if (!existing) {
    const hashed = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    sqlite.prepare("INSERT INTO users (email, password) VALUES (?, ?)").run(ADMIN_EMAIL, hashed);
  }
}
seedAdmin();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_12345";

function nextSortOrder(table: "projects" | "posts" | "docs", parentId?: number | null) {
  const row = table === "docs"
    ? sqlite.prepare(
      parentId == null
        ? "SELECT COALESCE(MAX(sortOrder), 0) + 1 AS next FROM docs WHERE parentId IS NULL"
        : "SELECT COALESCE(MAX(sortOrder), 0) + 1 AS next FROM docs WHERE parentId = ?"
    ).get(...(parentId == null ? [] : [parentId])) as { next: number }
    : sqlite.prepare(`SELECT COALESCE(MAX(sortOrder), 0) + 1 AS next FROM ${table}`).get() as { next: number };
  return row.next;
}

function updateSortOrder(table: "projects" | "posts" | "docs", ids: unknown[]) {
  const numericIds = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (numericIds.length !== ids.length) return false;
  const update = sqlite.prepare(`UPDATE ${table} SET sortOrder = ? WHERE id = ?`);
  const tx = sqlite.transaction(() => {
    numericIds.forEach((id, index) => update.run(index + 1, id));
  });
  tx();
  return true;
}

function isDescendantDoc(parentId: number, possibleChildId: number): boolean {
  const children = sqlite.prepare("SELECT id FROM docs WHERE parentId = ?").all(parentId) as { id: number }[];
  for (const child of children) {
    if (child.id === possibleChildId || isDescendantDoc(child.id, possibleChildId)) return true;
  }
  return false;
}

function updateDocSiblingOrder(ids: unknown[]) {
  const numericIds = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (numericIds.length !== ids.length) return false;
  const update = sqlite.prepare("UPDATE docs SET sortOrder = ? WHERE id = ?");
  numericIds.forEach((id, index) => update.run(index + 1, id));
  return true;
}

function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  app.use(express.json());

  // --- API ROUTES ---

  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Upload endpoint
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // Auth: Register —— 已关闭，仅允许预置管理员登录
  app.post("/api/auth/register", (req, res) => {
    res.status(403).json({ error: "注册已关闭" });
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = sqlite.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user) {
        return res.status(401).json({ error: "用户名或密码错误" });
      }
      
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "用户名或密码错误" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Auth: Verify
  app.get("/api/auth/verify", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    const token = authHeader.split(" ")[1];
    
    try {
      jwt.verify(token, JWT_SECRET);
      res.json({ valid: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Projects API
  app.get("/api/projects", (req, res) => {
    const list = sqlite.prepare("SELECT * FROM projects ORDER BY sortOrder, id").all();
    res.json(list);
  });

  app.put("/api/projects/reorder", requireAuth, (req, res) => {
    if (!Array.isArray(req.body.ids) || !updateSortOrder("projects", req.body.ids)) {
      return res.status(400).json({ error: "Invalid ids" });
    }
    res.json({ ok: true });
  });

  app.get("/api/projects/:id", (req, res) => {
    const project = sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!project) return res.status(404).json({ error: "Not found" });
    res.json(project);
  });

  app.post("/api/projects", requireAuth, (req, res) => {
    const { num, title, subtitle, description, longDescription, overview, category, role, period, features, tags, stack, imageUrl, link, github } = req.body;
    const info = sqlite.prepare(
      "INSERT INTO projects (num, title, subtitle, description, longDescription, overview, category, role, period, features, tags, stack, imageUrl, link, github, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(num, title, subtitle, description, longDescription, overview, category, role, period, features, tags, stack, imageUrl, link, github, nextSortOrder("projects"));
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/projects/:id", requireAuth, (req, res) => {
    const { num, title, subtitle, description, longDescription, overview, category, role, period, features, tags, stack, imageUrl, link, github } = req.body;
    sqlite.prepare(
      "UPDATE projects SET num=?, title=?, subtitle=?, description=?, longDescription=?, overview=?, category=?, role=?, period=?, features=?, tags=?, stack=?, imageUrl=?, link=?, github=? WHERE id=?"
    ).run(num, title, subtitle, description, longDescription, overview, category, role, period, features, tags, stack, imageUrl, link, github, req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/projects/:id", requireAuth, (req, res) => {
    sqlite.prepare("DELETE FROM projects WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  // Posts API
  app.get("/api/posts", (req, res) => {
    const list = sqlite.prepare("SELECT * FROM posts ORDER BY sortOrder, id").all();
    res.json(list);
  });

  app.put("/api/posts/reorder", requireAuth, (req, res) => {
    if (!Array.isArray(req.body.ids) || !updateSortOrder("posts", req.body.ids)) {
      return res.status(400).json({ error: "Invalid ids" });
    }
    res.json({ ok: true });
  });

  app.post("/api/posts", requireAuth, (req, res) => {
    const { title, snippet, date, readTime, content } = req.body;
    const info = sqlite.prepare("INSERT INTO posts (title, snippet, date, readTime, content, sortOrder) VALUES (?, ?, ?, ?, ?, ?)").run(title, snippet, date, readTime, content, nextSortOrder("posts"));
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/posts/:id", requireAuth, (req, res) => {
    const { title, snippet, date, readTime, content } = req.body;
    sqlite.prepare("UPDATE posts SET title=?, snippet=?, date=?, readTime=?, content=? WHERE id=?").run(title, snippet, date, readTime, content, req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/posts/:id", requireAuth, (req, res) => {
    sqlite.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  // Docs (面经体系) API —— 嵌套树形结构
  app.get("/api/docs", (req, res) => {
    res.json(buildDocTree(null));
  });

  app.post("/api/docs", requireAuth, (req, res) => {
    const { parentId, title, isFolder, content } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "标题不能为空" });
    }
    const info = sqlite.prepare(
      "INSERT INTO docs (parentId, title, isFolder, content, sortOrder) VALUES (?, ?, ?, ?, ?)"
    ).run(parentId ?? null, title, isFolder ? 1 : 0, isFolder ? null : (content ?? ""), nextSortOrder("docs", parentId ?? null));
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/docs/reorder", requireAuth, (req, res) => {
    if (!Array.isArray(req.body.ids) || !updateSortOrder("docs", req.body.ids)) {
      return res.status(400).json({ error: "Invalid ids" });
    }
    res.json({ ok: true });
  });

  app.put("/api/docs/move", requireAuth, (req, res) => {
    const movedId = Number(req.body.movedId);
    const newParentId = req.body.newParentId == null ? null : Number(req.body.newParentId);
    const oldSiblingIds = Array.isArray(req.body.oldSiblingIds) ? req.body.oldSiblingIds : [];
    const newSiblingIds = Array.isArray(req.body.newSiblingIds) ? req.body.newSiblingIds : [];
    if (!Number.isFinite(movedId) || (newParentId !== null && !Number.isFinite(newParentId))) {
      return res.status(400).json({ error: "Invalid move target" });
    }
    if (newParentId !== null) {
      const parent = sqlite.prepare("SELECT id, isFolder FROM docs WHERE id = ?").get(newParentId) as any;
      if (!parent || !parent.isFolder) return res.status(400).json({ error: "Target parent must be a folder" });
      if (newParentId === movedId || isDescendantDoc(movedId, newParentId)) {
        return res.status(400).json({ error: "Cannot move a folder into itself" });
      }
    }

    const tx = sqlite.transaction(() => {
      sqlite.prepare("UPDATE docs SET parentId = ? WHERE id = ?").run(newParentId, movedId);
      if (!updateDocSiblingOrder(oldSiblingIds)) throw new Error("Invalid old sibling ids");
      if (!updateDocSiblingOrder(newSiblingIds)) throw new Error("Invalid new sibling ids");
    });

    try {
      tx();
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: "Invalid ids" });
    }
  });

  app.put("/api/docs/:id", requireAuth, (req, res) => {
    const { title, content } = req.body;
    sqlite.prepare("UPDATE docs SET title=?, content=? WHERE id=?").run(title, content ?? null, req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/docs/:id", requireAuth, (req, res) => {
    deleteDocRecursive(Number(req.params.id));
    res.json({ ok: true });
  });

  // Experiences (实践历程) API
  app.get("/api/experiences", (req, res) => {
    const list = sqlite.prepare("SELECT * FROM experiences ORDER BY id").all();
    res.json(list);
  });

  app.post("/api/experiences", requireAuth, (req, res) => {
    const { company, role, date, description, achievements, techStack } = req.body;
    const info = sqlite.prepare(
      "INSERT INTO experiences (company, role, date, description, achievements, techStack) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(company, role, date, description, achievements, techStack);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/experiences/:id", requireAuth, (req, res) => {
    const { company, role, date, description, achievements, techStack } = req.body;
    sqlite.prepare(
      "UPDATE experiences SET company=?, role=?, date=?, description=?, achievements=?, techStack=? WHERE id=?"
    ).run(company, role, date, description, achievements, techStack, req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/experiences/:id", requireAuth, (req, res) => {
    sqlite.prepare("DELETE FROM experiences WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });


  // --- VITE MIDDLEWARE / STATIC FILES ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
