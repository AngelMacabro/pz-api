const db = require('../db/database');

class RoleService {
  listRoles() {
    const roles = db.query('SELECT * FROM roles ORDER BY id ASC');
    return roles.map(role => {
      const perms = db.query(
        `SELECT p.id, p.name, p.description, p.category 
         FROM permissions p 
         JOIN role_permissions rp ON rp.permission_id = p.id 
         WHERE rp.role_id = ?`,
        [role.id]
      );
      return {
        ...role,
        permissions: perms
      };
    });
  }

  getRoleById(id) {
    const role = db.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) return null;

    const perms = db.query(
      `SELECT p.id, p.name, p.description, p.category 
       FROM permissions p 
       JOIN role_permissions rp ON rp.permission_id = p.id 
       WHERE rp.role_id = ?`,
      [id]
    );

    return {
      ...role,
      permissions: perms
    };
  }

  listPermissions() {
    return db.query('SELECT * FROM permissions ORDER BY category ASC, name ASC');
  }

  createRole({ name, description, permissionNames = [] }) {
    const cleanName = (name || '').trim().toLowerCase();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('El nombre del rol debe tener al menos 2 caracteres');
    }

    const existing = db.get('SELECT id FROM roles WHERE name = ?', [cleanName]);
    if (existing) {
      throw new Error('El rol ya existe');
    }

    return db.transaction(() => {
      const res = db.run(
        'INSERT INTO roles (name, description, is_system) VALUES (?, ?, 0)',
        [cleanName, description || null]
      );
      const roleId = Number(res.lastInsertRowid);

      for (const pName of permissionNames) {
        const perm = db.get('SELECT id FROM permissions WHERE name = ?', [pName]);
        if (perm) {
          db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, perm.id]);
        }
      }

      return this.getRoleById(roleId);
    });
  }

  updateRole(id, { description, permissionNames }) {
    const role = db.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      throw new Error('Rol no encontrado');
    }

    return db.transaction(() => {
      if (description !== undefined) {
        db.run('UPDATE roles SET description = ? WHERE id = ?', [description, id]);
      }

      if (Array.isArray(permissionNames)) {
        // If it is system admin role, ensure it keeps '*'
        if (role.name === 'admin' && !permissionNames.includes('*')) {
          permissionNames.push('*');
        }

        db.run('DELETE FROM role_permissions WHERE role_id = ?', [id]);
        for (const pName of permissionNames) {
          const perm = db.get('SELECT id FROM permissions WHERE name = ?', [pName]);
          if (perm) {
            db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, perm.id]);
          }
        }
      }

      return this.getRoleById(id);
    });
  }

  deleteRole(id) {
    const role = db.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      throw new Error('Rol no encontrado');
    }
    if (role.is_system) {
      throw new Error('No se pueden eliminar los roles predeterminados del sistema');
    }

    return db.transaction(() => {
      db.run('DELETE FROM roles WHERE id = ?', [id]);
      return { success: true };
    });
  }
}

module.exports = new RoleService();
