import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import multer from "multer";
import { knowledgeDocs, experiences as seedExperiences } from "./src/data";

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
];
for (const sql of projectMigrations) {
  try { sqlite.exec(sql); } catch {}
}

// 首次启动时，把 data.ts 中的静态面经数据种入 docs 表，方便后台直接管理
function seedDocs() {
  const row = sqlite.prepare("SELECT COUNT(*) AS c FROM docs").get() as { c: number };
  if (row.c > 0) return;
  const insert = sqlite.prepare(
    "INSERT INTO docs (parentId, title, isFolder, content) VALUES (?, ?, ?, ?)"
  );
  const walk = (nodes: typeof knowledgeDocs, parentId: number | null) => {
    for (const n of nodes) {
      const info = insert.run(parentId, n.title, n.isFolder ? 1 : 0, n.content ?? null);
      if (n.children && n.children.length > 0) {
        walk(n.children, Number(info.lastInsertRowid));
      }
    }
  };
  const seedAll = sqlite.transaction(() => walk(knowledgeDocs, null));
  seedAll();
}
seedDocs();

// 把扁平的 docs 行组装成嵌套树（id 转为 string 以匹配前端 DocNode）
function buildDocTree(parentId: number | null): any[] {
  const rows = (parentId === null
    ? sqlite.prepare("SELECT * FROM docs WHERE parentId IS NULL ORDER BY id").all()
    : sqlite.prepare("SELECT * FROM docs WHERE parentId = ? ORDER BY id").all(parentId)
  ) as any[];
  return rows.map((r) => ({
    id: String(r.id),
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

// 首次启动时，把 data.ts 中的静态实践历程种入 experiences 表
function seedExperiencesData() {
  const row = sqlite.prepare("SELECT COUNT(*) AS c FROM experiences").get() as { c: number };
  if (row.c > 0) return;
  const insert = sqlite.prepare(
    "INSERT INTO experiences (company, role, date, description, achievements, techStack) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const tx = sqlite.transaction(() => {
    for (const e of seedExperiences) {
      insert.run(e.company, e.role, e.date, e.description, JSON.stringify(e.achievements), JSON.stringify(e.techStack));
    }
  });
  tx();
}
seedExperiencesData();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_12345";

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
  const PORT = Number(process.env.PORT) || 3000;

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

  // Auth: Register
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    try {
      const existing = sqlite.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (existing) {
        return res.status(400).json({ error: "邮箱已存在" });
      }
      const hashed = await bcrypt.hash(password, 10);
      const info = sqlite.prepare("INSERT INTO users (email, password) VALUES (?, ?)").run(email, hashed);
      
      const token = jwt.sign({ userId: info.lastInsertRowid }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
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
    const list = sqlite.prepare("SELECT * FROM projects").all();
    res.json(list);
  });

  app.post("/api/projects", requireAuth, (req, res) => {
    const { title, description, longDescription, features, tags, imageUrl, link, github } = req.body;
    const info = sqlite.prepare(
      "INSERT INTO projects (title, description, longDescription, features, tags, imageUrl, link, github) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(title, description, longDescription, features, tags, imageUrl, link, github);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/projects/:id", requireAuth, (req, res) => {
    const { title, description, longDescription, features, tags, imageUrl, link, github } = req.body;
    sqlite.prepare(
      "UPDATE projects SET title=?, description=?, longDescription=?, features=?, tags=?, imageUrl=?, link=?, github=? WHERE id=?"
    ).run(title, description, longDescription, features, tags, imageUrl, link, github, req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/projects/:id", requireAuth, (req, res) => {
    sqlite.prepare("DELETE FROM projects WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  // Posts API
  app.get("/api/posts", (req, res) => {
    const list = sqlite.prepare("SELECT * FROM posts").all();
    res.json(list);
  });

  app.post("/api/posts", requireAuth, (req, res) => {
    const { title, snippet, date, readTime, content } = req.body;
    const info = sqlite.prepare("INSERT INTO posts (title, snippet, date, readTime, content) VALUES (?, ?, ?, ?, ?)").run(title, snippet, date, readTime, content);
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
      "INSERT INTO docs (parentId, title, isFolder, content) VALUES (?, ?, ?, ?)"
    ).run(parentId ?? null, title, isFolder ? 1 : 0, isFolder ? null : (content ?? ""));
    res.json({ id: info.lastInsertRowid });
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
