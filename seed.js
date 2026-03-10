const db = require("./db");
const bcrypt = require("bcrypt");

async function seedAdmin() {
  try {
    const hashedPassword = await bcrypt.hash("1234", 10);

    db.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      ["admin", hashedPassword, "admin"],
      (err) => {
        if (err) {
          console.log("⚠ Admin already exists or error:", err.message);
        } else {
          console.log("✅ Admin user created successfully!");
        }
        process.exit();
      }
    );
  } catch (error) {
    console.log("❌ Error:", error);
    process.exit();
  }
}

seedAdmin();