import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.DB_PORT ?? '3306', 10),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'terminal_au',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  timezone: 'Z',
});

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const databaseName = process.env.DB_NAME ?? 'terminal_au';
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [databaseName, tableName, columnName],
  );

  return (rows as Array<{ 1: number }>).length > 0;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
  const databaseName = process.env.DB_NAME ?? 'terminal_au';
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [databaseName, tableName, indexName],
  );

  return (rows as Array<{ 1: number }>).length > 0;
}

async function addColumnIfMissing(tableName: string, columnName: string, definitionSql: string): Promise<void> {
  const exists = await columnExists(tableName, columnName);
  if (exists) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
}

export async function ensureDatabaseSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS terminals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(120) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_terminals_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_terminal_branch_code (branch_id, code)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(80) PRIMARY KEY,
      setting_value JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      terminal_id INT NOT NULL,
      category ENUM('fixed', 'variable', 'payroll') NOT NULL,
      title VARCHAR(180) NOT NULL,
      description VARCHAR(255) NULL,
      amount DECIMAL(10,2) NOT NULL,
      expense_date DATETIME NOT NULL,
      payment_method ENUM('cash', 'transfer', 'card', 'other') NOT NULL DEFAULT 'cash',
      notes TEXT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_expenses_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      CONSTRAINT fk_expenses_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
      CONSTRAINT fk_expenses_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_expenses_date (expense_date),
      INDEX idx_expenses_category (category)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_folios (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashier_shifts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      branch_id INT NOT NULL,
      terminal_id INT NOT NULL,
      opening_cash DECIMAL(10,2) NOT NULL,
      opening_note VARCHAR(255) NULL,
      expected_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
      closing_cash DECIMAL(10,2) NULL,
      difference_amount DECIMAL(10,2) NULL,
      closing_note VARCHAR(255) NULL,
      opened_at DATETIME NOT NULL,
      closed_at DATETIME NULL,
      status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_cashier_shift_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_cashier_shift_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      CONSTRAINT fk_cashier_shift_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
      INDEX idx_cashier_shift_user_open (user_id, status),
      INDEX idx_cashier_shift_opened (opened_at)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_schedules (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      branch_id INT NOT NULL,
      terminal_id INT NOT NULL,
      day_of_week TINYINT UNSIGNED NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      notes VARCHAR(255) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_emp_schedule_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_emp_schedule_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      CONSTRAINT fk_emp_schedule_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
      INDEX idx_emp_schedule_user_day (user_id, day_of_week, is_active),
      INDEX idx_emp_schedule_branch_terminal (branch_id, terminal_id)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      terminal_id INT NOT NULL,
      plate_number VARCHAR(20) NOT NULL,
      internal_code VARCHAR(30) NULL,
      vehicle_type VARCHAR(30) NOT NULL DEFAULT 'autobus',
      capacity TINYINT UNSIGNED NOT NULL DEFAULT 40,
      operational_status ENUM('active', 'maintenance', 'inactive') NOT NULL DEFAULT 'active',
      photo_url VARCHAR(500) NULL,
      notes VARCHAR(255) NULL,
      last_inspection_at DATETIME NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_vehicles_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      CONSTRAINT fk_vehicles_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_vehicle_plate (plate_number),
      UNIQUE KEY uq_vehicle_internal_code (internal_code),
      INDEX idx_vehicle_branch_terminal_status (branch_id, terminal_id, operational_status)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_issue_reports (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      vehicle_id BIGINT NOT NULL,
      branch_id INT NOT NULL,
      terminal_id INT NOT NULL,
      reported_by_user_id INT NOT NULL,
      severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
      issue_type VARCHAR(60) NOT NULL,
      description VARCHAR(600) NOT NULL,
      status ENUM('reported', 'in_repair', 'resolved') NOT NULL DEFAULT 'reported',
      resolution_note VARCHAR(600) NULL,
      reported_at DATETIME NOT NULL,
      resolved_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_vehicle_issue_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
      CONSTRAINT fk_vehicle_issue_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      CONSTRAINT fk_vehicle_issue_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
      CONSTRAINT fk_vehicle_issue_reporter FOREIGN KEY (reported_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_vehicle_issue_status (status),
      INDEX idx_vehicle_issue_vehicle (vehicle_id),
      INDEX idx_vehicle_issue_terminal_status (terminal_id, status),
      INDEX idx_vehicle_issue_reported_at (reported_at)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS financial_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      shift_id BIGINT NULL,
      user_id INT NOT NULL,
      branch_id INT NOT NULL,
      terminal_id INT NOT NULL,
      event_type ENUM('ticket_sale', 'ticket_cancel', 'ticket_refund', 'expense', 'shift_open', 'shift_close', 'adjustment') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      reference_type VARCHAR(30) NOT NULL,
      reference_id VARCHAR(60) NULL,
      notes VARCHAR(255) NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL,
      CONSTRAINT fk_fin_event_shift FOREIGN KEY (shift_id) REFERENCES cashier_shifts(id) ON DELETE SET NULL,
      CONSTRAINT fk_fin_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_fin_event_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      CONSTRAINT fk_fin_event_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
      INDEX idx_fin_event_created (created_at),
      INDEX idx_fin_event_shift (shift_id),
      INDEX idx_fin_event_type (event_type)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      idempotency_key VARCHAR(80) NOT NULL,
      endpoint VARCHAR(120) NOT NULL,
      user_id INT NOT NULL,
      status_code SMALLINT NOT NULL,
      response_body JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_idempotency_key_endpoint_user (idempotency_key, endpoint, user_id),
      CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_jobs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      job_type VARCHAR(50) NOT NULL,
      payload JSON NOT NULL,
      status ENUM('pending', 'processing', 'done', 'failed') NOT NULL DEFAULT 'pending',
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      scheduled_at DATETIME NOT NULL,
      processed_at DATETIME NULL,
      last_error VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_event_jobs_status_schedule (status, scheduled_at)
    ) ENGINE=InnoDB
  `);

  await addColumnIfMissing('tickets', 'passenger_age', 'TINYINT UNSIGNED NULL AFTER passenger_name');
  await addColumnIfMissing('tickets', 'base_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER passenger_age');
  await addColumnIfMissing('tickets', 'ticket_folio', 'BIGINT NULL AFTER id');
  await addColumnIfMissing('tickets', 'branch_id', 'INT NULL AFTER ticket_folio');
  await addColumnIfMissing('tickets', 'terminal_id', 'INT NULL AFTER branch_id');
  await addColumnIfMissing(
    'tickets',
    'discount_type',
    "ENUM('none', 'child', 'senior') NOT NULL DEFAULT 'none' AFTER base_price",
  );
  await addColumnIfMissing('tickets', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER discount_type');
  await addColumnIfMissing('tickets', 'idempotency_key', 'VARCHAR(80) NULL AFTER status');
  await addColumnIfMissing('trips', 'requires_passenger_name', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER destination');
  await addColumnIfMissing('trips', 'vehicle_type', "VARCHAR(30) NOT NULL DEFAULT 'autobus' AFTER requires_passenger_name");
  await addColumnIfMissing('trips', 'seat_count', 'TINYINT UNSIGNED NOT NULL DEFAULT 40 AFTER requires_passenger_name');
  await addColumnIfMissing('users', 'branch_id', 'INT NULL AFTER role');
  await addColumnIfMissing('users', 'terminal_id', 'INT NULL AFTER branch_id');
  await addColumnIfMissing('users', 'full_name', 'VARCHAR(140) NULL AFTER email');
  await addColumnIfMissing('expenses', 'branch_id', 'INT NULL AFTER id');
  await addColumnIfMissing('expenses', 'terminal_id', 'INT NULL AFTER branch_id');
  await addColumnIfMissing('cashier_shifts', 'opening_note', 'VARCHAR(255) NULL AFTER opening_cash');
  await addColumnIfMissing('cashier_shifts', 'closing_note', 'VARCHAR(255) NULL AFTER difference_amount');
  await addColumnIfMissing('vehicles', 'last_inspection_at', 'DATETIME NULL AFTER notes');
  await addColumnIfMissing('vehicles', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER last_inspection_at');

  await pool.query(
    `INSERT INTO branches (code, name, is_active)
     VALUES ('MATRIZ', 'Terminal AU Matriz', 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
  );

  await pool.query(
    `INSERT INTO terminals (branch_id, code, name, is_active)
     SELECT b.id, 'T1', 'Terminal Principal', 1
     FROM branches b
     WHERE b.code = 'MATRIZ'
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
  );

  await pool.query(
    `UPDATE users u
     JOIN branches b ON b.code = 'MATRIZ'
     JOIN terminals t ON t.branch_id = b.id AND t.code = 'T1'
     SET u.branch_id = COALESCE(u.branch_id, b.id),
         u.terminal_id = COALESCE(u.terminal_id, t.id)`,
  );

  await pool.query(
    `UPDATE users
     SET full_name = COALESCE(full_name, SUBSTRING_INDEX(email, '@', 1))
     WHERE full_name IS NULL OR CHAR_LENGTH(TRIM(full_name)) = 0`,
  );

  await pool.query(
    `UPDATE expenses e
     JOIN branches b ON b.code = 'MATRIZ'
     JOIN terminals t ON t.branch_id = b.id AND t.code = 'T1'
     SET e.branch_id = COALESCE(e.branch_id, b.id),
         e.terminal_id = COALESCE(e.terminal_id, t.id)`,
  );

  await pool.query(
    `UPDATE tickets tk
     JOIN users u ON u.id = tk.user_id
     SET tk.branch_id = COALESCE(tk.branch_id, u.branch_id),
         tk.terminal_id = COALESCE(tk.terminal_id, u.terminal_id)`,
  );

  await pool.query(
    `INSERT INTO ticket_folios (created_at)
     SELECT tk.sold_at
     FROM tickets tk
     WHERE tk.ticket_folio IS NULL
     ORDER BY tk.id ASC`,
  );

  await pool.query(
    `UPDATE tickets tk
     JOIN (
       SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS row_num
       FROM tickets
       WHERE ticket_folio IS NULL
     ) missing ON missing.id = tk.id
     JOIN (
       SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS row_num
       FROM ticket_folios
     ) folio_map ON folio_map.row_num = missing.row_num
     SET tk.ticket_folio = folio_map.id
     WHERE tk.ticket_folio IS NULL`,
  );

  await pool.query('ALTER TABLE tickets MODIFY COLUMN ticket_folio BIGINT NOT NULL');
  if (!(await indexExists('tickets', 'uq_ticket_folio'))) {
    await pool.query('ALTER TABLE tickets ADD UNIQUE KEY uq_ticket_folio (ticket_folio)');
  }

  if (!(await indexExists('tickets', 'uq_ticket_idempotency'))) {
    await pool.query('ALTER TABLE tickets ADD UNIQUE KEY uq_ticket_idempotency (idempotency_key)');
  }

  await pool.query(
    "ALTER TABLE tickets MODIFY COLUMN discount_type ENUM('none', 'child', 'senior', 'disability') NOT NULL DEFAULT 'none'",
  );
  await pool.query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'seller', 'driver') NOT NULL DEFAULT 'seller'",
  );

  await pool.query('ALTER TABLE tickets MODIFY COLUMN branch_id INT NOT NULL');
  await pool.query('ALTER TABLE tickets MODIFY COLUMN terminal_id INT NOT NULL');
  await pool.query('ALTER TABLE expenses MODIFY COLUMN branch_id INT NOT NULL');
  await pool.query('ALTER TABLE expenses MODIFY COLUMN terminal_id INT NOT NULL');

  await pool.query('UPDATE tickets SET base_price = price WHERE base_price = 0');

  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (
       'discount_rules',
       JSON_OBJECT(
         'childMaxAge', 11,
         'childPercent', 50,
         'seniorMinAge', 60,
         'seniorPercent', 30,
         'childEnabled', CAST(1 AS JSON),
         'seniorEnabled', CAST(1 AS JSON),
         'disabilityEnabled', CAST(1 AS JSON),
         'disabilityPercent', 40
       )
     )
     ON DUPLICATE KEY UPDATE setting_key = setting_key`,
  );
}

export default pool;
