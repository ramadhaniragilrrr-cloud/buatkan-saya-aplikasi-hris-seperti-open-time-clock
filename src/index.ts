import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";

export class App extends DurableObject {
  private app: Hono;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.app = new Hono();
    this.setupRoutes();
    this.initDb();
  }

  private initDb() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        pin TEXT,
        face_descriptor TEXT,
        hourly_rate REAL DEFAULT 0,
        currency TEXT DEFAULT 'IDR',
        join_date TEXT
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        type TEXT CHECK(type IN ('in', 'out')),
        method TEXT,
        location TEXT,
        timestamp TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );

      CREATE TABLE IF NOT EXISTS payrolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        period_start TEXT,
        period_end TEXT,
        total_hours REAL,
        gross_pay REAL,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );
    `);

    // Seed if empty
    const count = this.ctx.storage.sql.exec("SELECT COUNT(*) as c FROM employees").one().c;
    if (count === 0) {
      this.ctx.storage.sql.exec(`
        INSERT INTO employees (name, email, hourly_rate, join_date) VALUES 
        ('Admin User', 'admin@hris.local', 150000, '2023-01-01'),
        ('Budi Santoso', 'budi@company.com', 50000, '2023-05-15'),
        ('Ani Wijaya', 'ani@company.com', 60000, '2023-06-20');
      `);
    }
  }

  private setupRoutes() {
    this.app.get('/api/health', (c) => c.json({ status: 'ok' }));

    this.app.get('/api/employees', (c) => {
      const rows = this.ctx.storage.sql.exec('SELECT * FROM employees').toArray();
      return c.json(rows);
    });

    this.app.post('/api/employees', async (c) => {
      const { name, email, hourly_rate, face_descriptor } = await c.req.json();
      this.ctx.storage.sql.exec(
        'INSERT INTO employees (name, email, hourly_rate, face_descriptor, join_date) VALUES (?, ?, ?, ?, ?)',
        name, email, hourly_rate || 0, face_descriptor || null, new Date().toISOString()
      );
      return c.json({ success: true }, 201);
    });

    this.app.get('/api/attendance', (c) => {
      const rows = this.ctx.storage.sql.exec(`
        SELECT a.*, e.name as employee_name 
        FROM attendance a 
        JOIN employees e ON a.employee_id = e.id 
        ORDER BY a.timestamp DESC
      `).toArray();
      return c.json(rows);
    });

    this.app.post('/api/attendance', async (c) => {
      const { employee_id, type, method, location } = await c.req.json();
      this.ctx.storage.sql.exec(
        'INSERT INTO attendance (employee_id, type, method, location, timestamp) VALUES (?, ?, ?, ?, ?)',
        employee_id, type, method, JSON.stringify(location || {}), new Date().toISOString()
      );
      return c.json({ success: true });
    });

    this.app.get('/api/payroll/calculate', (c) => {
      const { start, end } = c.req.query();
      const employees = this.ctx.storage.sql.exec('SELECT * FROM employees').toArray();
      const payrolls = [];

      for (const emp of employees) {
        const attendance = this.ctx.storage.sql.exec(
          `SELECT * FROM attendance 
           WHERE employee_id = ? AND timestamp BETWEEN ? AND ? 
           ORDER BY timestamp ASC`,
          emp.id, start || '1970-01-01', end || '2099-12-31'
        ).toArray();

        let totalHours = 0;
        let lastIn = null;

        for (const record of attendance) {
          if (record.type === 'in') {
            lastIn = new Date(record.timestamp);
          } else if (record.type === 'out' && lastIn) {
            const out = new Date(record.timestamp);
            totalHours += (out.getTime() - lastIn.getTime()) / (1000 * 60 * 60);
            lastIn = null;
          }
        }

        payrolls.push({
          employee_id: emp.id,
          employee_name: emp.name,
          total_hours: totalHours.toFixed(2),
          hourly_rate: emp.hourly_rate,
          gross_pay: (totalHours * emp.hourly_rate).toFixed(2)
        });
      }

      return c.json(payrolls);
    });
  }

  async fetch(request: Request) {
    return this.app.fetch(request);
  }
}
