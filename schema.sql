CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  pin TEXT,
  face_descriptor TEXT, -- Stored as JSON string
  hourly_rate REAL DEFAULT 0,
  currency TEXT DEFAULT 'IDR',
  join_date TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  type TEXT CHECK(type IN ('in', 'out')),
  method TEXT, -- 'face', 'pin', 'manual'
  location TEXT, -- JSON string
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
  status TEXT DEFAULT 'pending', -- 'pending', 'paid'
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Seed some initial data
INSERT INTO employees (name, email, hourly_rate, join_date) VALUES ('Admin User', 'admin@hris.local', 150000, '2023-01-01');
INSERT INTO employees (name, email, hourly_rate, join_date) VALUES ('Budi Santoso', 'budi@company.com', 50000, '2023-05-15');
INSERT INTO employees (name, email, hourly_rate, join_date) VALUES ('Ani Wijaya', 'ani@company.com', 60000, '2023-06-20');
