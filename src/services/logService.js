const fs = require('fs');
const path = require('path');

class LogService {
  constructor() {
    this.maxBufferSize = 1500;
    this.buffer = [];
    this.logDir = path.resolve(__dirname, '../../logs');
    this.subscribers = new Set();
    this.ensureLogDir();
  }

  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('[LogService] Could not create logs directory:', err);
    }
  }

  getTodayLogPath(prefix = 'server') {
    const dateStr = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${prefix}_${dateStr}.log`);
  }

  addSubscriber(ws) {
    this.subscribers.add(ws);
  }

  removeSubscriber(ws) {
    this.subscribers.delete(ws);
  }

  log(message, type = 'stdout', source = 'server') {
    if (typeof message !== 'string') {
      message = String(message);
    }

    // Split multiline messages
    const lines = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    
    for (const line of lines) {
      if (line.trim().length === 0 && lines.length > 1) continue;

      const logEntry = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        timeFormatted: new Date().toLocaleTimeString('es-ES', { hour12: false }),
        type, // 'stdout' | 'stderr' | 'system' | 'steamcmd' | 'error' | 'success' | 'warn'
        source, // 'server' | 'steamcmd' | 'dashboard'
        message: line
      };

      // Add to ring buffer
      this.buffer.push(logEntry);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }

      // Write to persistent disk file
      this.appendToFile(logEntry, source);

      // Broadcast to WebSocket clients
      this.broadcast(logEntry);
    }
  }

  appendToFile(entry, source) {
    try {
      const file = this.getTodayLogPath(source);
      const formatted = `[${entry.timeFormatted}] [${entry.type.toUpperCase()}] ${entry.message}\n`;
      fs.appendFile(file, formatted, 'utf-8', (err) => {
        if (err) {
          // ignore disk write errors during busy cycles
        }
      });
    } catch (err) {
      // ignore
    }
  }

  broadcast(entry) {
    const payload = JSON.stringify({
      type: 'LOG_ENTRY',
      data: entry
    });

    for (const ws of this.subscribers) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        try {
          ws.send(payload);
        } catch (err) {
          this.subscribers.delete(ws);
        }
      }
    }
  }

  getRecentLogs(limit = 500) {
    return this.buffer.slice(-limit);
  }

  clearBuffer() {
    this.buffer = [];
    return true;
  }
}

module.exports = new LogService();
