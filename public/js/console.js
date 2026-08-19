/**
 * Console & Live Terminal Controller
 */
class ConsoleController {
  constructor() {
    this.terminalBody = document.getElementById('full-terminal-body');
    this.miniTerminalBody = document.getElementById('mini-terminal-feed');
    this.cmdInput = document.getElementById('terminal-cmd-input');
    this.btnSend = document.getElementById('btn-send-cmd');
    this.chkAutoscroll = document.getElementById('chk-autoscroll');
    this.inputFilter = document.getElementById('input-log-filter');
    this.btnClear = document.getElementById('btn-clear-terminal');
    this.btnDownload = document.getElementById('btn-download-log');

    this.logsList = [];
    this.commandHistory = [];
    this.historyIndex = -1;
    this.maxDomLines = 1000;

    this.init();
  }

  init() {
    // Bind Send Command
    if (this.btnSend && this.cmdInput) {
      this.btnSend.addEventListener('click', () => this.handleSendCommand());
      this.cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSendCommand();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateHistory(1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateHistory(-1);
        }
      });
    }

    // Quick Command Buttons
    document.querySelectorAll('.btn-quick-cmd').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const cmd = e.currentTarget.dataset.cmd;
        if (cmd) {
          this.sendCommand(cmd);
        }
      });
    });

    // Clear Terminal
    if (this.btnClear) {
      this.btnClear.addEventListener('click', () => {
        this.clear();
      });
    }

    // Download Logs
    if (this.btnDownload) {
      this.btnDownload.addEventListener('click', () => {
        this.downloadLogs();
      });
    }

    // Search Filter
    if (this.inputFilter) {
      this.inputFilter.addEventListener('input', () => {
        this.applyFilter();
      });
    }

    // Listen for WebSocket logs
    wsClient.on('onLog', (logEntry) => {
      this.appendLog(logEntry);
    });
  }

  appendLog(entry) {
    this.logsList.push(entry);
    if (this.logsList.length > 2000) {
      this.logsList.shift();
    }

    // Append to Full Terminal
    if (this.terminalBody) {
      const lineEl = this.createLogElement(entry);
      this.terminalBody.appendChild(lineEl);

      // Keep DOM clean
      while (this.terminalBody.children.length > this.maxDomLines) {
        this.terminalBody.removeChild(this.terminalBody.firstChild);
      }

      if (this.chkAutoscroll && this.chkAutoscroll.checked) {
        this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
      }
    }

    // Append to Mini Terminal Feed on Dashboard
    if (this.miniTerminalBody) {
      const miniLine = document.createElement('div');
      miniLine.className = `log-line log-${entry.type}`;
      miniLine.textContent = `[${entry.timeFormatted}] ${entry.message}`;
      this.miniTerminalBody.appendChild(miniLine);

      while (this.miniTerminalBody.children.length > 40) {
        this.miniTerminalBody.removeChild(this.miniTerminalBody.firstChild);
      }

      this.miniTerminalBody.scrollTop = this.miniTerminalBody.scrollHeight;
    }
  }

  createLogElement(entry) {
    const el = document.createElement('div');
    el.className = `log-line log-${entry.type || 'stdout'}`;
    el.dataset.text = (entry.message || '').toLowerCase();

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${entry.timeFormatted || ''}]`;

    const contentSpan = document.createElement('span');
    contentSpan.className = 'log-content';
    contentSpan.textContent = entry.message || '';

    el.appendChild(timeSpan);
    el.appendChild(contentSpan);

    // Apply current filter visibility
    if (this.inputFilter && this.inputFilter.value.trim().length > 0) {
      const query = this.inputFilter.value.trim().toLowerCase();
      if (!el.dataset.text.includes(query)) {
        el.style.display = 'none';
      }
    }

    return el;
  }

  applyFilter() {
    if (!this.inputFilter || !this.terminalBody) return;
    const query = this.inputFilter.value.trim().toLowerCase();

    const lines = this.terminalBody.querySelectorAll('.log-line');
    lines.forEach((line) => {
      if (!query || line.dataset.text.includes(query)) {
        line.style.display = 'flex';
      } else {
        line.style.display = 'none';
      }
    });
  }

  async handleSendCommand() {
    if (!this.cmdInput) return;
    const cmd = this.cmdInput.value.trim();
    if (!cmd) return;

    // Add to history
    this.commandHistory.unshift(cmd);
    this.historyIndex = -1;

    this.cmdInput.value = '';
    await this.sendCommand(cmd);
  }

  async sendCommand(cmd) {
    try {
      wsClient.sendCommand(cmd);
      // Fallback via HTTP if WS not ready
      await API.sendCommand(cmd);
    } catch (err) {
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error al enviar comando: ${err.message}`, 'error');
      }
    }
  }

  navigateHistory(direction) {
    if (this.commandHistory.length === 0 || !this.cmdInput) return;

    if (direction === 1) { // Up
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.cmdInput.value = this.commandHistory[this.historyIndex];
      }
    } else if (direction === -1) { // Down
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.cmdInput.value = this.commandHistory[this.historyIndex];
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.cmdInput.value = '';
      }
    }
  }

  clear() {
    if (this.terminalBody) this.terminalBody.innerHTML = '';
    if (this.miniTerminalBody) this.miniTerminalBody.innerHTML = '';
    this.logsList = [];
    API.clearLogs();
  }

  downloadLogs() {
    const text = this.logsList
      .map(e => `[${e.timestamp}] [${(e.type || 'stdout').toUpperCase()}] ${e.message}`)
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pz_server_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
