CREATE DATABASE IF NOT EXISTS terminal_au CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE terminal_au;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  full_name VARCHAR(140) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'seller', 'driver') NOT NULL DEFAULT 'seller',
  branch_id INT NULL,
  terminal_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id VARCHAR(80) NOT NULL,
  origin VARCHAR(120) NOT NULL,
  destination VARCHAR(120) NOT NULL,
  requires_passenger_name TINYINT(1) NOT NULL DEFAULT 1,
  vehicle_type VARCHAR(30) NOT NULL DEFAULT 'autobus',
  seat_count TINYINT UNSIGNED NOT NULL DEFAULT 40,
  departure_time DATETIME NOT NULL,
  arrival_time DATETIME NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status ENUM('scheduled', 'in-transit', 'arrived', 'completed') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_trips_departure (departure_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_folio BIGINT NOT NULL,
  branch_id INT NOT NULL,
  terminal_id INT NOT NULL,
  trip_id INT NOT NULL,
  seat_number INT NOT NULL,
  passenger_name VARCHAR(180) NOT NULL,
  passenger_age TINYINT UNSIGNED NULL,
  base_price DECIMAL(10,2) NOT NULL,
  discount_type ENUM('none', 'child', 'senior', 'disability') NOT NULL DEFAULT 'none',
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  sold_at DATETIME NOT NULL,
  user_id INT NOT NULL,
  status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
  idempotency_key VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_folio (ticket_folio),
  UNIQUE KEY uq_ticket_idempotency (idempotency_key),
  CONSTRAINT fk_tickets_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE RESTRICT,
  INDEX idx_tickets_trip_status (trip_id, status),
  INDEX idx_tickets_sold (sold_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_folios (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

INSERT INTO branches (code, name, is_active)
VALUES ('MATRIZ', 'Terminal AU Matriz', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO terminals (branch_id, code, name, is_active)
SELECT b.id, 'T1', 'Terminal Principal', 1
FROM branches b
WHERE b.code = 'MATRIZ'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO app_settings (setting_key, setting_value)
VALUES (
  'discount_rules',
  JSON_OBJECT(
    'childMaxAge', 11,
    'childPercent', 50,
    'seniorMinAge', 60,
    'seniorPercent', 30,
    'childEnabled', true,
    'seniorEnabled', true,
    'disabilityEnabled', true,
    'disabilityPercent', 40
  )
)
ON DUPLICATE KEY UPDATE setting_key = setting_key;
