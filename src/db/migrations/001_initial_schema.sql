-- Migration 001: Initial RBAC Schema and Default Seed Data

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Roles Relationship
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

-- 5. Role Permissions Relationship
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- 6. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Seed Permissions
INSERT OR IGNORE INTO permissions (name, description, category) VALUES
  ('*', 'Acceso total sin restricciones a todas las funcionalidades', 'System'),
  ('server.view', 'Ver estado, métricas y detalles del servidor', 'Server'),
  ('server.start', 'Iniciar el servidor de Project Zomboid', 'Server'),
  ('server.stop', 'Detener o forzar el apagado del servidor', 'Server'),
  ('server.restart', 'Reiniciar el servidor de Project Zomboid', 'Server'),
  ('server.command', 'Ejecutar comandos en la consola / RCON', 'Server'),
  ('server.install', 'Instalar o actualizar el servidor con SteamCMD', 'Server'),
  ('server.config.read', 'Leer configuración del servidor (.ini, json)', 'Config'),
  ('server.config.write', 'Guardar cambios en la configuración del servidor', 'Config'),
  ('mods.view', 'Ver la lista de mods y workshop items instalados', 'Mods'),
  ('mods.manage', 'Instalar, actualizar, parsear y remover mods', 'Mods'),
  ('files.read', 'Leer y explorar archivos de configuración y scripts', 'Files'),
  ('files.write', 'Guardar modificaciones en archivos de configuración', 'Files'),
  ('logs.view', 'Ver el stream y archivo de logs del servidor', 'Logs'),
  ('logs.clear', 'Limpiar el buffer de logs en memoria', 'Logs'),
  ('users.view', 'Ver lista de usuarios y detalles de cuentas', 'Users'),
  ('users.manage', 'Crear, editar, activar, desactivar y eliminar usuarios', 'Users'),
  ('roles.view', 'Consultar roles y permisos del sistema', 'Roles'),
  ('roles.manage', 'Crear y modificar roles y sus permisos asignados', 'Roles'),
  ('audit.view', 'Consultar el registro de auditoría de seguridad', 'Audit');

-- Seed Base Roles
INSERT OR IGNORE INTO roles (name, description, is_system) VALUES
  ('admin', 'Administrador con acceso completo a todo el sistema', 1),
  ('operator', 'Operador del servidor con permisos de gestión, mods y configuración', 1),
  ('analyst', 'Analista de métricas, estadísticas y logs en modo lectura', 1),
  ('viewer', 'Visualizador con acceso básico de solo lectura al estado del servidor', 1);

-- Map Permissions to Roles
-- 1. Admin Role -> Wildcard '*'
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.name = '*';

-- 2. Operator Role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'operator' AND p.name IN (
  'server.view', 'server.start', 'server.stop', 'server.restart', 'server.command', 'server.install',
  'server.config.read', 'server.config.write',
  'mods.view', 'mods.manage',
  'files.read', 'files.write',
  'logs.view'
);

-- 3. Analyst Role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'analyst' AND p.name IN ('server.view', 'logs.view');

-- 4. Viewer Role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.name IN ('server.view');
