/**
 * Real-time WebSocket Client for PZ Dashboard
 */
class WsClient {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.listeners = {
      onLog: [],
      onStatus: [],
      onMetrics: [],
      onInit: []
    };
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Conectado al servidor en tiempo real.');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleMessage(payload);
        } catch (e) {
          console.error('[WebSocket] Error parseando mensaje:', e);
        }
      };

      this.ws.onclose = () => {
        console.warn('[WebSocket] Conexión cerrada. Reconectando en 3s...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  handleMessage(payload) {
    switch (payload.type) {
      case 'INIT_STATE':
        this.emit('onInit', payload.data);
        if (payload.data && payload.data.status) {
          this.emit('onStatus', payload.data.status);
        }
        if (payload.data && payload.data.recentLogs) {
          for (const log of payload.data.recentLogs) {
            this.emit('onLog', log);
          }
        }
        break;

      case 'LOG_ENTRY':
        this.emit('onLog', payload.data);
        break;

      case 'HEARTBEAT':
        if (payload.data && payload.data.status) {
          this.emit('onStatus', payload.data.status);
        }
        if (payload.data && payload.data.metrics) {
          this.emit('onMetrics', payload.data.metrics);
        }
        break;

      case 'COMMAND_ERROR':
        if (window.App && window.App.showToast) {
          window.App.showToast(`Error de comando: ${payload.error}`, 'error');
        }
        break;
    }
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[WebSocket] Error in listener for ${event}:`, e);
        }
      }
    }
  }

  sendCommand(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SEND_COMMAND',
        command
      }));
    }
  }
}

const wsClient = new WsClient();
