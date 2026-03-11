require('dotenv').config();
const express = require("express");
const cors    = require("cors");
const db      = require("./db");
const bcrypt  = require("bcrypt");
const jwt     = require("jsonwebtoken");
const path    = require("path");

const app    = express();
const SECRET = process.env.JWT_SECRET || "fallbacksecretkey";
const PORT   = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ============================================================
   RATE LIMITER — in-memory (login route only)
   ============================================================ */
const loginAttempts     = new Map();
const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 60 * 1000;

function rateLimitLogin(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const rec = loginAttempts.get(ip);

  if (rec) {
    const elapsed = now - rec.firstAttempt;
    if (elapsed > RATE_LIMIT_WINDOW) {
      loginAttempts.delete(ip);
    } else if (rec.count >= RATE_LIMIT_MAX) {
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - elapsed) / 1000);
      return res.status(429).json({
        error: `Too many login attempts. Try again in ${retryAfter} seconds.`
      });
    }
  }
  next();
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) loginAttempts.set(ip, { count: 1, firstAttempt: now });
  else rec.count++;
}

/* ============================================================
   ACTIVITY LOG HELPER
   ============================================================ */
function logActivity(action, studentName, adminId) {
  db.query(
    "INSERT INTO activity_log (action, student_name, admin_id) VALUES (?, ?, ?)",
    [action, studentName, adminId || null],
    (err) => { if (err) console.error("Activity log error:", err); }
  );
}

/* ============================================================
   INPUT VALIDATION
   ============================================================ */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateStudent({ name, email }) {
  const errors = [];
  if (!name || name.trim().length < 2)
    errors.push("Name must be at least 2 characters.");
  if (!email || !isValidEmail(email.trim()))
    errors.push("A valid email address is required.");
  return errors;
}

/* ============================================================
   AUTH MIDDLEWARE
   ============================================================ */
function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(403).send("Access denied");
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).send("Invalid token");
    req.user = decoded;
    next();
  });
}

/* ============================================================
   ROUTES — AUTH
   ============================================================ */
app.post("/login", rateLimitLogin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required." });

  const ip = req.ip || req.connection.remoteAddress;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, result) => {
    if (err || result.length === 0) {
      recordFailedLogin(ip);
      return res.status(401).send("User not found");
    }

    const user  = result[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      recordFailedLogin(ip);
      return res.status(401).send("Wrong password");
    }

    loginAttempts.delete(ip);
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "2h" });
    res.json({ token });
  });
});

/* ============================================================
   ROUTES — STUDENTS (sort + pagination + search)
   ============================================================ */

// GET /students/stats — MUST be before /students/:id
app.get("/students/stats", authenticate, (req, res) => {
  const queries = {
    byMonth:  "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count FROM students GROUP BY month ORDER BY month",
    byAge:    "SELECT CASE WHEN TIMESTAMPDIFF(YEAR, birthdate, CURDATE()) < 18 THEN 'Under 18' WHEN TIMESTAMPDIFF(YEAR, birthdate, CURDATE()) BETWEEN 18 AND 22 THEN '18-22' WHEN TIMESTAMPDIFF(YEAR, birthdate, CURDATE()) BETWEEN 23 AND 27 THEN '23-27' ELSE '28+' END AS age_group, COUNT(*) AS count FROM students WHERE birthdate IS NOT NULL GROUP BY age_group",
    total:    "SELECT COUNT(*) AS total FROM students",
    newest:   "SELECT name, created_at FROM students ORDER BY created_at DESC LIMIT 1"
  };

  const results = {};
  const keys = Object.keys(queries);
  let done = 0;

  keys.forEach(key => {
    db.query(queries[key], (err, rows) => {
      if (err) results[key] = [];
      else results[key] = rows;
      if (++done === keys.length) res.json(results);
    });
  });
});

app.get("/students", authenticate, (req, res) => {
  const search  = req.query.search || "";
  const sortBy  = ["name", "email", "birthdate", "created_at"].includes(req.query.sort)
                  ? req.query.sort : "created_at";
  const order   = req.query.order === "asc" ? "ASC" : "DESC";
  const page    = Math.max(1, parseInt(req.query.page)  || 1);
  const limit   = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset  = (page - 1) * limit;

  const where  = search ? "WHERE name LIKE ? OR email LIKE ?" : "";
  const params = search ? [`%${search}%`, `%${search}%`] : [];

  db.query(`SELECT COUNT(*) AS total FROM students ${where}`, params, (err, countResult) => {
    if (err) return res.status(500).send(err);
    const total = countResult[0].total;

    const sql = `SELECT * FROM students ${where} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`;
    db.query(sql, [...params, limit, offset], (err2, rows) => {
      if (err2) return res.status(500).send(err2);
      res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
    });
  });
});

app.post("/students", authenticate, (req, res) => {
  const { name, email, birthdate } = req.body;
  const errors = validateStudent({ name, email });
  if (errors.length) return res.status(400).json({ errors });

  db.query(
    "INSERT INTO students (name, email, birthdate) VALUES (?, ?, ?)",
    [name.trim(), email.trim(), birthdate || null],
    (err) => {
      if (err) return res.status(500).send(err);
      logActivity(`Added student`, name.trim(), req.user.id);
      res.json({ message: "Student added" });
    }
  );
});

app.put("/students/:id", authenticate, (req, res) => {
  const { name, email, birthdate } = req.body;
  const errors = validateStudent({ name, email });
  if (errors.length) return res.status(400).json({ errors });

  db.query(
    "UPDATE students SET name = ?, email = ?, birthdate = ? WHERE id = ?",
    [name.trim(), email.trim(), birthdate || null, req.params.id],
    (err) => {
      if (err) return res.status(500).send(err);
      logActivity(`Updated student`, name.trim(), req.user.id);
      res.json({ message: "Student updated" });
    }
  );
});

app.delete("/students/:id", authenticate, (req, res) => {
  // get name before deleting for the log
  db.query("SELECT name FROM students WHERE id = ?", [req.params.id], (err, rows) => {
    const name = rows && rows[0] ? rows[0].name : `ID ${req.params.id}`;
    db.query("DELETE FROM students WHERE id = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).send(err2);
      logActivity(`Deleted student`, name, req.user.id);
      res.json({ message: "Student deleted" });
    });
  });
});

/* ============================================================
   ROUTES — ACTIVITY LOG
   ============================================================ */
app.get("/activity", authenticate, (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  db.query(
    "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?",
    [limit],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});

/* ============================================================
   STATIC FILES
   ============================================================ */
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/login.html`);
});
