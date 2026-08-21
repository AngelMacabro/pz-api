const WebSocket = require('ws');
const logService = require('../services/logService');
const pzProcessService = require('../services/pzProcessService');
const systemService = require('../services/systemService');
const authService = require('../services/authService');
const { hasPermission } = require('../middleware/authMiddleware');

class WebSocketHandler {
  constructor() {
    this.wss = null;
    this.heartbeatInterval = null;
  }

  parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach(cookie => {
      let [name, ...rest] = cookie.split('=');
      name = name?.trim();
      if (!name) return;
      const rawValue = rest.join('=').trim();
      try {
        list[name] = decodeURIComponent(rawValue);
      } catch (e) {
        list[name] = rawValue;
      }
    });

    return list;
  }

  extractTokenFromRequest(req) {
    // 1. From Cookie header
    if (req.headers && req.headers.cookie) {
      const cookies = this.parseCookies(req.headers.cookie);
      if (cookies[authService.cookieName]) {
        return cookies[authService.cookieName];
      }
    }

    // 2. From URL query string ?token=xxx
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) return token;
    } catch (e) {
      // ignore
    }

    return null;
  }

  init(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      const token = this.extractTokenFromRequest(req);
      const user = authService.validateSession(token);

      if (!user) {
        console.warn('[WebSocket] Conexión rechazada: sesión no autenticada o inválida');
        ws.send(JSON.stringify({
          type: 'AUTH_REQUIRED',
          error: 'Autenticación requerida para acceder al WebSocket'
        }));
        ws.close(1008, 'Unauthorized');
        return;
      }

      // Store authenticated user and token in ws session
      ws.user = user;
      ws.token = token;
      console.log(`[WebSocket] Cliente conectado: ${user.username} (${user.roles.join(', ')})`);

      // Add client to logService broadcast pool if authorized
      if (hasPermission(user.permissions, 'logs.view')) {
        logService.addSubscriber(ws);
      }

      // Send initial state & recent logs if authorized
      const initData = {};
      if (hasPermission(user.permissions, 'server.view')) {
        initData.status = pzProcessService.getState();
      }
      if (hasPermission(user.permissions, 'logs.view')) {
        initData.recentLogs = logService.getRecentLogs(200);
      }

      ws.send(JSON.stringify({
        type: 'INIT_STATE',
        data: initData
      }));

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          this.handleClientMessage(ws, parsed);
        } catch (e) {
          // ignore non-JSON messages
        }
      });

      ws.on('close', () => {
        logService.removeSubscriber(ws);
      });

      ws.on('error', () => {
        logService.removeSubscriber(ws);
      });
    });

    // Start periodic status broadcast every 1500ms
    this.startHeartbeat();
  }

  handleClientMessage(ws, data) {
    // Re-verify session in real time
    if (ws.token) {
      const freshUser = authService.validateSession(ws.token);
      if (!freshUser) {
        ws.send(JSON.stringify({
          type: 'AUTH_REQUIRED',
          error: 'Sesión expirada o revocada'
        }));
        ws.close(4001, 'Session revoked');
        return;
      }
      ws.user = freshUser;
    }

    if (!ws.user) {
      ws.send(JSON.stringify({
        type: 'COMMAND_ERROR',
        error: 'Sesión no autenticada'
      }));
      return;
    }

    if (data.type === 'SEND_COMMAND' && data.command) {
      // RBAC check: server.command
      if (!hasPermission(ws.user.permissions, 'server.command')) {
        ws.send(JSON.stringify({
          type: 'COMMAND_ERROR',
          error: 'No tienes permiso para ejecutar comandos en el servidor (server.command requerido)'
        }));
        return;
      }

      try {
        pzProcessService.sendCommand(data.command);
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'COMMAND_ERROR',
          error: err.message
        }));
      }
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      if (!this.wss || this.wss.clients.size === 0) return;

      try {
        const status = pzProcessService.getState();
        const metrics = await systemService.getSystemMetrics(status.pid);

        const payload = JSON.stringify({
          type: 'HEARTBEAT',
          data: {
            status,
            metrics
          }
        });

        for (const client of this.wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            // Re-validate session if token is attached
            if (client.token) {
              const freshUser = authService.validateSession(client.token);
              if (!freshUser) {
                client.send(JSON.stringify({
                  type: 'AUTH_REQUIRED',
                  error: 'Sesión expirada o revocada'
                }));
                client.close(4001, 'Session revoked');
                continue;
              }
              client.user = freshUser;
            }

            if (client.user && hasPermission(client.user.permissions, 'server.view')) {
              client.send(payload);
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1500);
  }
}

module.exports = new WebSocketHandler();
