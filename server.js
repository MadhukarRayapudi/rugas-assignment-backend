const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const dbPath = path.join(__dirname, "server.db");
const app = express();
app.use(express.json());

let db = null;

// Initialize database and server
const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });
        app.listen(5000, () => {
            console.log("Server running at http://localhost:5000");
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
};

initializeDBAndServer();

// Hardcoded roles and JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";
const roles = {
    ADMIN: "admin",
    EMPLOYEE: "employee",
};

// Authentication Middleware
const authenticateToken = (roleRequired) => (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).send("Access token required");

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send("Invalid token");
        if (roleRequired && user.role !== roleRequired)
            return res.status(403).send("Forbidden");
        req.user = user;
        next();
    });
};

// Generate Token for Testing
app.get("/token", (req, res) => {
    const { role } = req.query; // Pass role as query parameter (e.g., ?role=admin)
    if (!roles[role?.toUpperCase()]) {
        return res.status(400).send("Invalid role");
    }
    const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: "1h" });
    res.send({ token });
});

// Laptops APIs
app.post("/laptops", authenticateToken("admin"), async (req, res) => {
    const { brand, model, serialNumber, status, purchaseDate } = req.body;
    const query = `
        INSERT INTO laptops (brand, model, serial_number, status, purchase_date)
        VALUES ('${brand}', '${model}', '${serialNumber}', '${status}', '${purchaseDate}');
    `;
    await db.run(query);
    res.send("Laptop added successfully");
});

app.get("/laptops", authenticateToken(), async (req, res) => {
    const query = "SELECT * FROM laptops ORDER BY id;";
    const laptops = await db.all(query);
    res.send(laptops);
});

app.put("/laptops/:id", authenticateToken("admin"), async (req, res) => {
    const { id } = req.params;
    const { brand, model, serialNumber, status, purchaseDate } = req.body;
    const query = `
        UPDATE laptops
        SET brand = '${brand}', model = '${model}', serial_number = '${serialNumber}',
            status = '${status}', purchase_date = '${purchaseDate}'
        WHERE id = ${id};
    `;
    await db.run(query);
    res.send(`Laptop with ID ${id} updated successfully`);
});

app.delete("/laptops/:id", authenticateToken("admin"), async (req, res) => {
    const { id } = req.params;
    const query = `DELETE FROM laptops WHERE id = ${id};`;
    await db.run(query);
    res.send(`Laptop with ID ${id} deleted successfully`);
});

// Employees APIs
app.get("/employees", authenticateToken(), async (req, res) => {
    const query = "SELECT * FROM employees ORDER BY id;";
    const employees = await db.all(query);
    res.send(employees);
});

// Assign a laptop to an employee
app.post("/assignments", authenticateToken("admin"), async (req, res) => {
    const { laptopId, employeeId, assignedAt } = req.body;
    const query = `
        INSERT INTO assignments (laptop_id, employee_id, assigned_at, returned_at)
        VALUES (${laptopId}, ${employeeId}, '${assignedAt}', NULL);
    `;
    await db.run(query);
    await db.run(`UPDATE laptops SET status = 'assigned' WHERE id = ${laptopId};`);
    res.send("Laptop assigned successfully");
});


app.get("/assignments/:employeeId", authenticateToken(), async (req, res) => {
    const { employeeId } = req.params;
    const query = `
        SELECT a.id, l.brand, l.model, l.serial_number, a.assigned_at, a.returned_at
        FROM assignments a
        JOIN laptops l ON a.laptop_id = l.id
        WHERE a.employee_id = ${employeeId};
    `;
    const assignments = await db.all(query);
    res.send(assignments);
});

// Maintenance APIs
app.post("/maintenance", authenticateToken("admin"), async (req, res) => {
    const { laptopId, description, cost, loggedAt } = req.body;
    const query = `
        INSERT INTO maintenance (laptop_id, description, cost, logged_at)
        VALUES (${laptopId}, '${description}', ${cost}, '${loggedAt}');
    `;
    await db.run(query);
    await db.run(`UPDATE laptops SET status = 'maintenance' WHERE id = ${laptopId};`);
    res.send("Maintenance log added successfully");
});

app.get("/maintenance/:laptopId", authenticateToken(), async (req, res) => {
    const { laptopId } = req.params;
    const query = `
        SELECT * FROM maintenance WHERE laptop_id = ${laptopId};
    `;
    const maintenanceLogs = await db.all(query);
    res.send(maintenanceLogs);
});

// Issues APIs
app.post("/issues", authenticateToken(), async (req, res) => {
    const { laptopId, description, priority, reportedBy, reportedAt } = req.body;
    const query = `
        INSERT INTO issues (laptop_id, description, priority, status, reported_by, reported_at)
        VALUES (${laptopId}, '${description}', '${priority}', 'open', '${reportedBy}', '${reportedAt}');
    `;
    await db.run(query);
    res.send("Issue reported successfully");
});

app.get("/issues/:laptopId", authenticateToken(), async (req, res) => {
    const { laptopId } = req.params;
    const query = `
        SELECT * FROM issues WHERE laptop_id = ${laptopId};
    `;
    const issues = await db.all(query);
    res.send(issues);
});
