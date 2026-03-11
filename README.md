# 🎓 Student Manager

A full-stack student management portal built with **Node.js**, **Express**, **MySQL**, and vanilla **HTML/CSS/JS** — featuring JWT authentication, a polished dark/light UI, real-time charts, activity logging, and paginated/sorted data.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 JWT Authentication | Login with bcrypt-hashed passwords, 2h token expiry |
| 🛡️ Rate Limiting | Max 5 login attempts per 60s — server-side (IP) + client-side |
| ✅ Input Validation | Inline field errors on client + full validation on server |
| 🌙 Dark / Light Mode | Persisted in `localStorage`, smooth CSS variable transitions |
| 📊 Charts Dashboard | Monthly registrations (bar) + age distribution (doughnut) via Chart.js |
| 📄 Pagination | Server-side — 10 per page, smart page buttons with ellipsis |
| ↕️ Sort | Click to sort by name, birthdate, or date added — asc/desc toggle |
| 🕒 Activity Log | Every add/edit/delete logged to DB with timestamp — live sidebar |
| 🔔 Toast Notifications | Animated toasts replace all `alert()` calls |
| 🗑️ Custom Delete Modal | Styled confirm dialog instead of `window.confirm()` |
| ⬇️ Export CSV | Download current page as a dated `.csv` file |
| 💀 Loading Skeleton | Shimmer placeholders while data fetches |
| 🔍 Live Search | Debounced real-time filtering by name or email |
| 📱 Responsive | Mobile, tablet, and desktop layouts |

---

## 🎥 Demo Video

[![Watch the demo](https://img.youtube.com/vi/40RxThEQMeU/0.jpg)](https://www.youtube.com/watch?v=40RxThEQMeU)
---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL + mysql2
- **Auth:** JWT (`jsonwebtoken`) + bcrypt
- **Charts:** Chart.js 4 (loaded from CDN)
- **Frontend:** Vanilla HTML, CSS (custom dark/light theme), JavaScript
- **Fonts:** Syne + DM Sans via Google Fonts

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/your-username/student-manager.git
cd student-manager
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=student_db
JWT_SECRET=your_strong_random_secret
PORT=3000
```

### 4. Create the database
```sql
CREATE DATABASE student_db;
USE student_db;

CREATE TABLE users (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE students (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  birthdate  DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  action       VARCHAR(100) NOT NULL,
  student_name VARCHAR(150),
  admin_id     INT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Seed the admin user
```bash
node seed.js
```

### 6. Run the server
```bash
node server.js
# → http://localhost:3000/login.html
```

---



## 🔌 API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/login` | ❌ | Authenticate and receive JWT |
| `GET` | `/students` | ✅ | List students — supports `?search=`, `?sort=`, `?order=`, `?page=`, `?limit=` |
| `POST` | `/students` | ✅ | Add a new student |
| `PUT` | `/students/:id` | ✅ | Update a student |
| `DELETE` | `/students/:id` | ✅ | Delete a student |
| `GET` | `/students/stats` | ✅ | Aggregated stats for charts |
| `GET` | `/activity` | ✅ | Recent activity log (last 20 entries) |

---

## 🔒 Security Notes

- `.env` is in `.gitignore` — never commit it
- Passwords hashed with **bcrypt** (salt rounds: 10)
- All routes except `/login` require a valid JWT
- Login rate-limited to **5 attempts / 60s per IP** (server) and tracked client-side too
- All student inputs validated on both client and server

---

## 📄 License

MIT
