const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const authService = require('../services/authService');
const auditService = require('../services/auditService');
const { requirePermission } = require('../middleware/authMiddleware');

// GET /api/users - List users
router.get('/', requirePermission('users.view'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const users = userService.listUsers({ limit, offset });
    const total = userService.countUsers();

    res.json({
      success: true,
      users,
      total,
      limit,
      offset
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', requirePermission('users.view'), (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = userService.getUserWithPermissions(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users - Create new user
router.post('/', requirePermission('users.manage'), async (req, res) => {
  try {
    const { username, email, password, roles, isActive } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    const newUser = await userService.createUser({
      username,
      email,
      password,
      roleNames: Array.isArray(roles) && roles.length > 0 ? roles : ['viewer'],
      isActive: isActive !== undefined ? isActive : 1
    });

    auditService.log(
      req.user.id,
      req.user.username,
      'users.create',
      { createdUserId: newUser.id, username: newUser.username, roles: newUser.roles },
      ipAddress
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: newUser
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH /api/users/:id - Update user
router.patch('/:id', requirePermission('users.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { email, password, isActive, roles } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    const updatedUser = await userService.updateUser(userId, {
      email,
      password,
      isActive,
      roleNames: roles
    });

    // If password or active state changed, invalidate existing sessions of that user
    if (password || isActive === false) {
      authService.invalidateAllUserSessions(userId);
    }

    auditService.log(
      req.user.id,
      req.user.username,
      'users.update',
      { targetUserId: userId, updatedFields: Object.keys(req.body) },
      ipAddress
    );

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', requirePermission('users.manage'), (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    if (req.user.id === userId) {
      return res.status(400).json({
        success: false,
        error: 'No puedes eliminar tu propia cuenta de usuario actualmente en sesión'
      });
    }

    const userToDelete = userService.getUserById(userId);
    if (!userToDelete) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    userService.deleteUser(userId);
    authService.invalidateAllUserSessions(userId);

    auditService.log(
      req.user.id,
      req.user.username,
      'users.delete',
      { deletedUserId: userId, username: userToDelete.username },
      ipAddress
    );

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
