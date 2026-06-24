import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import multer from "multer";

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
  const PORT = 3000;

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
