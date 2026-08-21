const authService = require('../services/authService');

function extractToken(req) {
  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies[authService.cookieName]) {
    return req.cookies[authService.cookieName];
  }

  // 2. Check Authorization Header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Checks if a set of granted permissions satisfies a required permission.
 * Supports '*' (global wildcard) and category wildcards like 'server.*' or 'mods.*'.
 */
function hasPermission(userPermissions, requiredPermission) {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
    return false;
  }

  // 1. Global wildcard grant
  if (userPermissions.includes('*')) {
    return true;
  }

  // 2. Exact match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // 3. Category wildcard match (e.g. user has 'mods.*' and requires 'mods.view')
  const parts = requiredPermission.split('.');
  if (parts.length > 1) {
    const categoryWildcard = `${parts[0]}.*`;
    if (userPermissions.includes(categoryWildcard)) {
      return true;
    }
  }

  return false;
}

/**
 * Middleware: Optional session identification (does not block if anonymous)
 */
function authOptional(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const user = authService.validateSession(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

/**
 * Middleware: Strict authentication required (returns 401 Unauthorized if not logged in)
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Autenticación requerida. Por favor, inicia sesión.',
      code: 'UNAUTHORIZED'
    });
  }

  const user = authService.validateSession(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Sesión inválida o expirada. Por favor, inicia sesión nuevamente.',
      code: 'INVALID_SESSION'
    });
  }

  req.user = user;
  req.token = token;
  next();
}

/**
 * Middleware: Specific permission required (returns 403 Forbidden if not authorized)
 */
function requirePermission(permissionName) {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Autenticación requerida.',
          code: 'UNAUTHORIZED'
        });
      }

      const user = authService.validateSession(token);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Sesión inválida o expirada.',
          code: 'INVALID_SESSION'
        });
      }

      req.user = user;
      req.token = token;
    }

    if (!hasPermission(req.user.permissions, permissionName)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado. Permiso requerido: '${permissionName}'.`,
        code: 'FORBIDDEN',
        requiredPermission: permissionName
      });
    }

    next();
  };
}

/**
 * Middleware: Specific role required (returns 403 Forbidden if missing role)
 */
function requireRole(roleName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación requerida.',
        code: 'UNAUTHORIZED'
      });
    }

    const hasRole = req.user.roles && (req.user.roles.includes(roleName) || req.user.roles.includes('admin'));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Acceso restringido al rol: '${roleName}'.`,
        code: 'FORBIDDEN'
      });
    }

    next();
  };
}

module.exports = {
  extractToken,
  hasPermission,
  authOptional,
  requireAuth,
  requirePermission,
  requireRole
};
