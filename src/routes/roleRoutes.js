const express = require('express');
const router = express.Router();
const roleService = require('../services/roleService');
const auditService = require('../services/auditService');
const { requirePermission } = require('../middleware/authMiddleware');

// GET /api/roles - List all roles with permissions
router.get('/', requirePermission('roles.view'), (req, res) => {
  try {
    const roles = roleService.listRoles();
    res.json({ success: true, roles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/roles/permissions - List all available system permissions
router.get('/permissions', requirePermission('roles.view'), (req, res) => {
  try {
    const permissions = roleService.listPermissions();
    res.json({ success: true, permissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/roles/:id - Get role by ID
router.get('/:id', requirePermission('roles.view'), (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const role = roleService.getRoleById(roleId);

    if (!role) {
      return res.status(404).json({ success: false, error: 'Rol no encontrado' });
    }

    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/roles - Create custom role
router.post('/', requirePermission('roles.manage'), (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    const newRole = roleService.createRole({
      name,
      description,
      permissionNames: permissions || []
    });

    auditService.log(
      req.user.id,
      req.user.username,
      'roles.create',
      { roleId: newRole.id, name: newRole.name },
      ipAddress
    );

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      role: newRole
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH /api/roles/:id - Update role
router.patch('/:id', requirePermission('roles.manage'), (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const { description, permissions } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    const updatedRole = roleService.updateRole(roleId, {
      description,
      permissionNames: permissions
    });

    auditService.log(
      req.user.id,
      req.user.username,
      'roles.update',
      { roleId, name: updatedRole.name },
      ipAddress
    );

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente',
      role: updatedRole
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/roles/:id - Delete custom role
router.delete('/:id', requirePermission('roles.manage'), (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    roleService.deleteRole(roleId);

    auditService.log(
      req.user.id,
      req.user.username,
      'roles.delete',
      { roleId },
      ipAddress
    );

    res.json({
      success: true,
      message: 'Rol eliminado exitosamente'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
