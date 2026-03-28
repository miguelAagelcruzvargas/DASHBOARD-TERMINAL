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

async function addColumnIfMissing(tableName: string, columnName: string, definitionSql: string): Promise<void> {
  const exists = await columnExists(tableName, columnName);
  if (exists) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
}

export async function ensureDatabaseSchema(): Promise<void> {
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
      CONSTRAINT fk_expenses_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_expenses_date (expense_date),
      INDEX idx_expenses_category (category)
    ) ENGINE=InnoDB
  `);

  await addColumnIfMissing('tickets', 'passenger_age', 'TINYINT UNSIGNED NULL AFTER passenger_name');
  await addColumnIfMissing('tickets', 'base_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER passenger_age');
  await addColumnIfMissing(
    'tickets',
    'discount_type',
    "ENUM('none', 'child', 'senior') NOT NULL DEFAULT 'none' AFTER base_price",
  );
  await addColumnIfMissing('tickets', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER discount_type');
  await addColumnIfMissing('trips', 'requires_passenger_name', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER destination');
  await addColumnIfMissing('trips', 'vehicle_type', "VARCHAR(30) NOT NULL DEFAULT 'autobus' AFTER requires_passenger_name");
  await addColumnIfMissing('trips', 'seat_count', 'TINYINT UNSIGNED NOT NULL DEFAULT 40 AFTER requires_passenger_name');

  await pool.query(
    "ALTER TABLE tickets MODIFY COLUMN discount_type ENUM('none', 'child', 'senior', 'disability') NOT NULL DEFAULT 'none'",
  );

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
