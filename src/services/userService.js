const bcrypt = require('bcryptjs');
const db = require('../db/database');

const BCRYPT_SALT_ROUNDS = 12;

class UserService {
  async hashPassword(plainPassword) {
    if (!plainPassword || typeof plainPassword !== 'string' || plainPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
  }

  async verifyPassword(plainPassword, passwordHash) {
    if (!plainPassword || !passwordHash) return false;
    return bcrypt.compare(plainPassword, passwordHash);
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  async createUser({ username, email, password, roleNames = ['viewer'], isActive = 1 }) {
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('El correo electrónico no es válido');
    }

    // Check existing
    const existingUser = db.get(
      'SELECT id, username, email FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE',
      [cleanUsername, cleanEmail]
    );

    if (existingUser) {
      if (existingUser.username.toLowerCase() === cleanUsername.toLowerCase()) {
        throw new Error('El nombre de usuario ya está registrado');
      }
      if (existingUser.email.toLowerCase() === cleanEmail.toLowerCase()) {
        throw new Error('El correo electrónico ya está registrado');
      }
    }

    const passwordHash = await this.hashPassword(password);

    return db.transaction(() => {
      const result = db.run(
        `INSERT INTO users (username, email, password_hash, is_active) 
         VALUES (?, ?, ?, ?)`,
        [cleanUsername, cleanEmail, passwordHash, isActive ? 1 : 0]
      );

      const userId = Number(result.lastInsertRowid);

      // Assign roles
      for (const rName of roleNames) {
        const role = db.get('SELECT id FROM roles WHERE name = ?', [rName]);
        if (role) {
          db.run(
            'INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, role.id]
          );
        }
      }

      return this.getUserWithPermissions(userId);
    });
  }

  getUserById(id) {
    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    return this.sanitizeUser(user);
  }

  getUserAuthDetailsById(id) {
    return db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  getUserByUsernameOrEmail(identifier) {
    const clean = (identifier || '').trim();
    return db.get(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE',
      [clean, clean.toLowerCase()]
    );
  }

  getUserRoles(userId) {
    const rows = db.query(
      `SELECT r.id, r.name, r.description 
       FROM roles r 
       JOIN user_roles ur ON ur.role_id = r.id 
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows;
  }

  getUserPermissions(userId) {
    const rows = db.query(
      `SELECT DISTINCT p.name, p.category, p.description 
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows.map(r => r.name);
  }

  getUserWithPermissions(userId) {
    const user = this.getUserById(userId);
    if (!user) return null;

    const roles = this.getUserRoles(userId);
    const permissions = this.getUserPermissions(userId);

    return {
      ...user,
      roles: roles.map(r => r.name),
      rolesDetails: roles,
      permissions
    };
  }

  listUsers({ limit = 50, offset = 0 } = {}) {
    const rows = db.query(
      `SELECT id, username, email, is_active, created_at, updated_at, last_login_at 
       FROM users 
       ORDER BY id ASC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return rows.map(u => {
      const roles = this.getUserRoles(u.id);
      return {
        ...u,
        roles: roles.map(r => r.name),
        rolesDetails: roles
      };
    });
  }

  countUsers() {
    const row = db.get('SELECT COUNT(*) as count FROM users');
    return row ? row.count : 0;
  }

  async updateUser(id, { email, password, isActive, roleNames }) {
    const existing = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Usuario no encontrado');
    }

    // Protection: do not allow deactivating the last active admin
    if (isActive !== undefined && !isActive && existing.is_active) {
      this.ensureNotLastAdmin(id);
    }

    const updates = [];
    const params = [];

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes('@')) {
        throw new Error('Correo electrónico inválido');
      }
      const duplicate = db.get(
        'SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?',
        [cleanEmail, id]
      );
      if (duplicate) {
        throw new Error('El correo electrónico ya está en uso');
      }
      updates.push('email = ?');
      params.push(cleanEmail);
    }

    if (password) {
      const hash = await this.hashPassword(password);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");

    return db.transaction(() => {
      if (updates.length > 0) {
        params.push(id);
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      if (Array.isArray(roleNames)) {
        // If changing roles, make sure we don't remove admin from the last admin
        if (!roleNames.includes('admin')) {
          const currentRoles = this.getUserRoles(id).map(r => r.name);
          if (currentRoles.includes('admin')) {
            this.ensureNotLastAdmin(id);
          }
        }

        db.run('DELETE FROM user_roles WHERE user_id = ?', [id]);
        for (const rName of roleNames) {
          const role = db.get('SELECT id FROM roles WHERE name = ?', [rName]);
          if (role) {
            db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, role.id]);
          }
        }
      }

      return this.getUserWithPermissions(id);
    });
  }

  deleteUser(id) {
    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    this.ensureNotLastAdmin(id);

    return db.transaction(() => {
      db.run('DELETE FROM users WHERE id = ?', [id]);
      return { success: true };
    });
  }

  ensureNotLastAdmin(userId) {
    const adminRole = db.get("SELECT id FROM roles WHERE name = 'admin'");
    if (!adminRole) return;

    const activeAdmins = db.query(
      `SELECT u.id 
       FROM users u 
       JOIN user_roles ur ON ur.user_id = u.id 
       WHERE ur.role_id = ? AND u.is_active = 1`,
      [adminRole.id]
    );

    const isCurrentAdmin = activeAdmins.some(a => a.id === Number(userId));
    if (isCurrentAdmin && activeAdmins.length <= 1) {
      throw new Error('Operación denegada: no se puede eliminar ni desactivar al único administrador activo del sistema.');
    }
  }

  updateLastLogin(userId) {
    try {
      db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    } catch (e) {
      // ignore
    }
  }
}

module.exports = new UserService();
