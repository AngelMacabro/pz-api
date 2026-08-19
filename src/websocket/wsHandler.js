const WebSocket = require('ws');
const logService = require('../services/logService');
const pzProcessService = require('../services/pzProcessService');
const systemService = require('../services/systemService');

class WebSocketHandler {
  constructor() {
    this.wss = null;
    this.heartbeatInterval = null;
  }

  init(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      // Add client to logService broadcast pool
      logService.addSubscriber(ws);

      // Send initial state & recent logs immediately on connect
      const status = pzProcessService.getState();
      ws.send(JSON.stringify({
        type: 'INIT_STATE',
        data: {
          status,
          recentLogs: logService.getRecentLogs(200)
        }
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
    if (data.type === 'SEND_COMMAND' && data.command) {
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
            client.send(payload);
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1500);
  }
}

module.exports = new WebSocketHandler();
