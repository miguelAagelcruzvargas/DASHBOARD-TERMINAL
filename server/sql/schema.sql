CREATE DATABASE IF NOT EXISTS terminal_au CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE terminal_au;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'seller') NOT NULL DEFAULT 'seller',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tickets_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_tickets_trip_status (trip_id, status),
  INDEX idx_tickets_sold (sold_at)
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
