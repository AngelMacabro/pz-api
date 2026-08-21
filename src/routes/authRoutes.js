const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const userService = require('../services/userService');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAuth, extractToken } = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    const result = await authService.login(username, password, { userAgent, ipAddress });

    // Set secure HttpOnly cookie
    res.cookie(authService.cookieName, result.rawToken, authService.getCookieOptions());

    res.json({
      success: true,
      user: result.user,
      token: result.rawToken, // Also provided in payload if client prefers Authorization header
      expiresAt: result.expiresAt
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const allowRegistration = process.env.ALLOW_REGISTRATION === 'true';

    // If no users exist in the system yet, allow first registration as admin
    const totalUsers = userService.countUsers();
    const isFirstUser = totalUsers === 0;

    if (!allowRegistration && !isFirstUser) {
      return res.status(403).json({
        success: false,
        error: 'El registro público está desactivado. Solicita una cuenta al administrador.'
      });
    }

    const { username, email, password } = req.body || {};
    const defaultRoles = isFirstUser ? ['admin'] : ['viewer'];

    const newUser = await userService.createUser({
      username,
      email,
      password,
      roleNames: defaultRoles,
      isActive: 1
    });

    // Auto-login after registration
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const loginResult = await authService.login(username, password, { userAgent, ipAddress });

    res.cookie(authService.cookieName, loginResult.rawToken, authService.getCookieOptions());

    res.status(201).json({
      success: true,
      message: isFirstUser 
        ? '¡Primer usuario administrador registrado e iniciado exitosamente!' 
        : 'Usuario registrado exitosamente',
      user: loginResult.user,
      token: loginResult.rawToken
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  const ipAddress = req.ip || req.connection.remoteAddress || null;

  if (token) {
    authService.logout(token, { ipAddress });
  }

  // Clear cookie
  res.clearCookie(authService.cookieName, { path: '/' });

  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
