const express = require("express");
const app = express();
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "markssheet.db");
let db = null;

const startDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS faculty_login (
        faculty_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        roll_number TEXT UNIQUE,
        activity1 TEXT,
        activity2 TEXT,
        activity3 TEXT,
        activity4 TEXT,
        activity5 TEXT
      );
    `);

    app.listen(3001, () => console.log("Backend running on port 3001"));
  } catch (e) {
    console.log("DB Error:", e);
    process.exit(1);
  }
};

startDB();

const JWT_SECRET = "SECRET_TOKEN"; 

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  let token;
  if (authHeader) token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send("Invalid JWT Token");
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).send("Invalid JWT Token");
    req.username = payload.username;
    next();
  });
};


app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("username and password required");

    const existing = await db.get("SELECT * FROM faculty_login WHERE username = ?", [username]);
    if (existing) return res.status(400).send("User Already Exists");
    if (password.length < 6) return res.status(400).send("Password too short");

    const hashed = await bcrypt.hash(password, 10);
    await db.run("INSERT INTO faculty_login (username, password) VALUES (?, ?)", [username, hashed]);

    res.send("Faculty Registered Successfully");
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).send("Server Error");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("username and password required");

    const user = await db.get("SELECT * FROM faculty_login WHERE username = ?", [username]);
    if (!user) return res.status(400).send("Invalid User");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send("Invalid Password");

    const token = jwt.sign({ username }, JWT_SECRET);
    res.send({ jwtToken: token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server Error");
  }
});


app.post("/add-student", authenticateToken, async (req, res) => {
  try {
    const { name, roll_number } = req.body;
    if (!name || !roll_number) return res.status(400).send("name and roll_number required");

    await db.run("INSERT INTO students (name, roll_number) VALUES (?, ?)", [name, roll_number]);
    res.send("Student Added Successfully");
  } catch (err) {
    console.error("Add student error:", err);
    if (err && err.message && err.message.includes("UNIQUE")) {
      return res.status(400).send("Roll Number Already Exists");
    }
    res.status(500).send("Server Error");
  }
});
app.put("/students/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, roll_number, activity1 = "", activity2 = "", activity3 = "", activity4 = "", activity5 = "" } = req.body;
  try {
    const result = await db.run(
      `UPDATE students SET name = ?, roll_number = ?, activity1 = ?, activity2 = ?, activity3 = ?, activity4 = ?, activity5 = ? WHERE id = ?`,
      [name, roll_number, activity1, activity2, activity3, activity4, activity5, id]
    );
    if (result.changes === 0) return res.status(404).send("Student Not Found");
    const updated = await db.get("SELECT * FROM students WHERE id = ?", [id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err && err.message && err.message.includes("UNIQUE")) return res.status(400).send("Roll Number Already Exists");
    res.status(500).send("Server Error");
  }
});

app.put("/update-activity", authenticateToken, async (req, res) => {
  try {
    const { roll_number, activity, marks } = req.body;

    const valid = ["activity1", "activity2", "activity3", "activity4", "activity5"];
    if (!valid.includes(activity)) return res.status(400).send("Invalid Activity");

    const query = `UPDATE students SET ${activity} = ? WHERE roll_number = ?`;
    const result = await db.run(query, [marks, roll_number]);

    if (result.changes === 0) {
      return res.status(400).send("Student Not Found");
    }

    res.send("Marks Updated Successfully");
  } catch (err) {
    console.error("Update activity error:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/students", authenticateToken, async (req, res) => {
  try {
    const data = await db.all("SELECT * FROM students ORDER BY id DESC");
    res.send(data);
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).send("Server Error");
  }
});

app.delete("/students/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.run("DELETE FROM students WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).send("Student Not Found");
    }
    res.send("Student Deleted Successfully");
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).send("Server Error");
  }
});

app.delete("/students/roll/:roll", authenticateToken, async (req, res) => {
  try {
    const { roll } = req.params;
    const result = await db.run("DELETE FROM students WHERE roll_number = ?", [roll]);
    if (result.changes === 0) {
      return res.status(404).send("Student Not Found");
    }
    res.send("Student Deleted Successfully");
  } catch (err) {
    console.error("Delete by roll error:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/", (req, res) => res.send("Marksheet backend is running"));

