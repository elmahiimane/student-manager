const getToken = () => localStorage.getItem("token");

// Route guard
if (!getToken() && !window.location.href.includes("login.html")) {
  window.location.href = "/login.html";
}

/* ============================================================
   THEME TOGGLE
   ============================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "light" ? "🌙" : "☀️";
}
function toggleTheme() {
  applyTheme((localStorage.getItem("theme") || "dark") === "dark" ? "light" : "dark");
}
applyTheme(localStorage.getItem("theme") || "dark");

/* ============================================================
   TOAST
   ============================================================ */
function showToast(type, title, msg) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const icons = { success: "✅", error: "❌", info: "💡", warning: "⚠️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <div class="toast-progress"></div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ============================================================
   CONFIRM MODAL
   ============================================================ */
function showConfirm(msg, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">🗑️</div>
      <div class="modal-title">Delete Student</div>
      <div class="modal-msg">${msg}</div>
      <div class="modal-actions">
        <button class="modal-btn cancel" id="modalCancel">Cancel</button>
        <button class="modal-btn confirm" id="modalConfirm">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById("modalConfirm").onclick = () => { overlay.remove(); onConfirm(); };
  document.getElementById("modalCancel").onclick  = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

/* ============================================================
   STATE
   ============================================================ */
let currentPage  = 1;
let totalPages   = 1;
let currentSort  = { by: "created_at", order: "desc" };
let searchQuery  = "";
let allStudents  = [];
let searchTimer;
let chartByMonth = null;
let chartByAge   = null;

/* ============================================================
   SORT
   ============================================================ */
function sortBy(field) {
  if (currentSort.by === field) {
    currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
  } else {
    currentSort.by    = field;
    currentSort.order = "asc";
  }
  currentPage = 1;
  updateSortIndicators();
  loadStudents();
}

function updateSortIndicators() {
  document.querySelectorAll(".sort-btn").forEach(btn => {
    const f = btn.dataset.sort;
    btn.classList.toggle("active", f === currentSort.by);
  });
}

/* ============================================================
   SEARCH
   ============================================================ */
document.getElementById("search")?.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    currentPage = 1;
    loadStudents();
  }, 300);
});

/* ============================================================
   LOAD STUDENTS
   ============================================================ */
async function loadStudents() {
  const params = new URLSearchParams({
    page:   currentPage,
    limit:  10,
    sort:   currentSort.by,
    order:  currentSort.order,
    search: searchQuery
  });

  try {
    const res = await fetch(`/students?${params}`, {
      headers: { Authorization: getToken() }
    });
    if (res.status === 401 || res.status === 403) { logout(); return; }

    const json     = await res.json();
    const students = Array.isArray(json.data) ? json.data : [];
    allStudents    = students;
    totalPages     = json.totalPages || 1;

    // update stat cards
    const totalEl  = document.getElementById("totalCount");
    const searchEl = document.getElementById("searchCount");
    const lastEl   = document.getElementById("lastAdded");
    if (totalEl)  totalEl.textContent  = json.total ?? students.length;
    if (searchEl) searchEl.textContent = searchQuery ? students.length : "—";
    if (lastEl)   lastEl.textContent   = students.length > 0
      ? students[0].name.split(" ")[0] : "—";

    renderStudents(students);
    renderPagination();
  } catch (err) {
    console.error("Load error:", err);
    showToast("error", "Error", "Could not load students");
  }
}

/* ============================================================
   RENDER STUDENTS
   ============================================================ */
function renderStudents(students) {
  const list = document.getElementById("studentList");
  if (!list) return;

  if (!students.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎓</div>
        <p>No students found. Add your first student above.</p>
      </div>`;
    return;
  }

  list.innerHTML = students.map((s, i) => {
    const dateStr  = s.birthdate ? `	${s.birthdate.split("T")[0]}` : "";
    const initials = s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const safeName = s.name.replace(/'/g, "\\'");
    return `
      <div class="student" style="animation-delay:${i * 0.04}s">
        <div class="student-left">
          <div class="student-avatar">${initials}</div>
          <div class="student-info">
            <strong>${s.name}</strong>
            <span>${s.email}${dateStr ? ` · ${dateStr}` : ""}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn-edit"   onclick="editStudent(${s.id},'${safeName}','${s.email}','${dateStr}')">Edit</button>
          <button class="btn-delete" onclick="deleteStudent(${s.id})">Delete</button>
        </div>
      </div>`;
  }).join("");
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  const c = document.getElementById("pagination");
  if (!c) return;
  if (totalPages <= 1) { c.innerHTML = ""; return; }

  let h = `<button onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1))
      h += `<button onclick="goPage(${i})" class="${i === currentPage ? "active" : ""}">${i}</button>`;
    else if (i === currentPage - 2 || i === currentPage + 2)
      h += `<span style="padding:0 4px">…</span>`;
  }
  h += `<button onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>›</button>`;
  c.innerHTML = h;
}

function goPage(p) {
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  loadStudents();
}

/* ============================================================
   ADD / EDIT FORM
   ============================================================ */
document.getElementById("studentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id        = document.getElementById("studentId").value;
  const name      = document.getElementById("name").value.trim();
  const email     = document.getElementById("email").value.trim();
  const birthdate = document.getElementById("birthdate").value;

  if (!name || name.length < 2) return showToast("error", "Validation", "Name min 2 characters");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("error", "Validation", "Valid email required");

  const method = id ? "PUT"             : "POST";
  const url    = id ? `/students/${id}` : "/students";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: getToken() },
      body: JSON.stringify({ name, email, birthdate })
    });

    if (res.ok) {
      showToast("success", id ? "Updated!" : "Added!", `${name} saved successfully`);
      cancelEdit();
      loadStudents();
      loadCharts();
      loadActivity();
    } else {
      const data = await res.json();
      showToast("error", "Error", data.errors?.[0] || data.error || "Something went wrong");
    }
  } catch { showToast("error", "Error", "Request failed"); }
});

function editStudent(id, name, email, birthdate) {
  document.getElementById("studentId").value  = id;
  document.getElementById("name").value       = name;
  document.getElementById("email").value      = email;
  document.getElementById("birthdate").value  = birthdate;
  const title = document.getElementById("formTitle");
  if (title) title.textContent = `Editing: ${name}`;
  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  document.getElementById("studentForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEdit() {
  document.getElementById("studentId").value = "";
  document.getElementById("studentForm").reset();
  const title = document.getElementById("formTitle");
  if (title) title.textContent = "Add New Student";
  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

/* ============================================================
   DELETE
   ============================================================ */
async function deleteStudent(id) {
  showConfirm("This action cannot be undone.", async () => {
    try {
      const res = await fetch(`/students/${id}`, {
        method: "DELETE",
        headers: { Authorization: getToken() }
      });
      if (res.ok) {
        showToast("error", "Deleted", "Student removed successfully");
        if (currentPage > 1) currentPage--;
        loadStudents();
        loadCharts();
        loadActivity();
      } else {
        showToast("error", "Error", "Delete failed");
      }
    } catch { showToast("error", "Error", "Request failed"); }
  });
}

/* ============================================================
   EXPORT CSV
   ============================================================ */
async function exportCSV() {
  showToast("info", "Exporting…", "Fetching all students from database");
  try {
    const res  = await fetch(`/students?page=1&limit=10000&sort=${currentSort.by}&order=${currentSort.order}`, {
      headers: { Authorization: getToken() }
    });
    const json = await res.json();
    const all  = Array.isArray(json.data) ? json.data : [];
    if (!all.length) { showToast("info", "Nothing to export", "No students in database."); return; }
    const header = ["ID", "Name", "Email", "Birthdate"];
    const rows   = all.map(s => [
      s.id,
      `"${s.name}"`,
      `"${s.email}"`,
      s.birthdate ? `	${s.birthdate.split("T")[0]}` : ""
    ]);
    const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `students_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("success", "Exported!", `${all.length} students exported.`);
  } catch { showToast("error", "Error", "Export failed"); }
}


/* ============================================================
   ACTIVITY LOG
   ============================================================ */
async function loadActivity() {
  const c = document.getElementById("activityLog");
  if (!c) return;
  try {
    const res  = await fetch("/activity", { headers: { Authorization: getToken() } });
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      c.innerHTML = `<p class="activity-empty">No activity yet</p>`; return;
    }
    const clr = { add: "#22c55e", edit: "#a78bfa", delete: "#ef4444" };
    const ico = { add: "➕", edit: "✏️", delete: "🗑️" };
    c.innerHTML = data.map(a => {
      const act  = (a.action || "").toLowerCase().includes("add")    ? "add"
                 : (a.action || "").toLowerCase().includes("updat") ||
                   (a.action || "").toLowerCase().includes("edit")   ? "edit" : "delete";
      const time = new Date(a.created_at).toLocaleString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
      });
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border,#eee)">
          <span>${ico[act] || "📋"}</span>
          <div>
            <div style="font-size:.85rem">
              <span style="color:${clr[act]};font-weight:600">${a.action}</span>
              — ${a.student_name || "Unknown"}
            </div>
            <div style="font-size:.75rem;opacity:.6">${time}</div>
          </div>
        </div>`;
    }).join("");
  } catch {
    c.innerHTML = `<p class="activity-empty">Could not load activity</p>`;
  }
}

/* ============================================================
   CHARTS
   ============================================================ */
async function loadCharts() {
  try {
    const res = await fetch("/students/stats", { headers: { Authorization: getToken() } });
    if (!res.ok) return;
    const stats = await res.json();

    if (typeof Chart === "undefined") {
      const scr   = document.createElement("script");
      scr.src     = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      scr.onload  = () => renderCharts(stats);
      scr.onerror = () => console.warn("Chart.js CDN failed");
      document.head.appendChild(scr);
    } else {
      renderCharts(stats);
    }
  } catch (e) { console.error("loadCharts:", e); }
}

function renderCharts(stats) {
  const textClr = (localStorage.getItem("theme") || "dark") === "dark" ? "#a0a0b0" : "#666";

  const c1 = document.getElementById("chartMonth");
  if (c1) {
    if (chartByMonth) chartByMonth.destroy();
    chartByMonth = new Chart(c1, {
      type: "bar",
      data: {
        labels:   (stats.byMonth || []).map(r => r.month),
        datasets: [{ label: "Registrations", data: (stats.byMonth || []).map(r => r.count),
          backgroundColor: "rgba(108,99,255,0.7)", borderColor: "#6c63ff",
          borderWidth: 2, borderRadius: 6 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: textClr, stepSize: 1 }, grid: { color: "rgba(128,128,128,0.1)" } },
          x: { ticks: { color: textClr }, grid: { display: false } }
        }}
    });
  }

  const c2 = document.getElementById("chartAge");
  if (c2) {
    if (chartByAge) chartByAge.destroy();
    chartByAge = new Chart(c2, {
      type: "doughnut",
      data: {
        labels:   (stats.byAge || []).map(r => r.range || r.age_group),
        datasets: [{ data: (stats.byAge || []).map(r => r.count),
          backgroundColor: ["#6c63ff","#ff6584","#43e97b","#f7971e"], borderWidth: 0 }]
      },
      options: { responsive: true,
        plugins: { legend: { position: "bottom", labels: { color: textClr, padding: 16 } } }
      }
    });
  }
}

/* ============================================================
   LOGOUT
   ============================================================ */
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
}

/* ============================================================
   LOGIN PAGE
   ============================================================ */
async function login() {
  const username = document.getElementById("username")?.value?.trim();
  const password = document.getElementById("password")?.value;
  if (!username || !password) return;
  const btn = document.querySelector(".btn-login");
  if (btn) { btn.textContent = "Signing in…"; btn.disabled = true; }
  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const msg = await res.text();
      showToast("error", "Access Denied", msg || "Wrong credentials.");
      if (btn) { btn.textContent = "Sign In"; btn.disabled = false; }
      return;
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    window.location.href = "/index.html";
  } catch {
    showToast("error", "Network Error", "Could not reach the server.");
    if (btn) { btn.textContent = "Sign In"; btn.disabled = false; }
  }
}

/* ============================================================
   INIT
   ============================================================ */
if (window.location.pathname.includes("index.html") || window.location.pathname === "/") {
  updateSortIndicators();
  loadStudents();
  loadCharts();
  loadActivity();
}