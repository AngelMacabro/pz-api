/**
 * Main Application Orchestrator
 */
class AppManager {
  constructor() {
    this.status = { state: 'stopped', pid: null, uptime: 0 };
    this.uptimeInterval = null;
    this.init();
  }

  init() {
    this.initTabs();
    this.initActionButtons();
    this.initWebSocketListeners();

    // Start WebSocket
    wsClient.connect();

    // Controllers
    this.consoleCtrl = new ConsoleController();
    this.configCtrl = new ConfigViewController();
    this.modCtrl = new ModViewController();
    this.fileEditorCtrl = new FileEditorController();

    // Global reference for toast
    window.App = this;
  }

  initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.dataset.tab;

        navItems.forEach(n => n.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.classList.add('active');

        // Special refreshes
        if (targetTabId === 'tab-files' && this.fileEditorCtrl) {
          this.fileEditorCtrl.loadFilesList();
        } else if (targetTabId === 'tab-mods' && this.modCtrl) {
          this.modCtrl.loadMods();
        } else if (targetTabId === 'tab-config' && this.configCtrl) {
          this.configCtrl.loadConfig();
        }
      });
    });

    const btnGotoConsole = document.getElementById('btn-goto-console');
    if (btnGotoConsole) {
      btnGotoConsole.addEventListener('click', () => {
        const consoleNavBtn = document.querySelector('[data-tab="tab-console"]');
        if (consoleNavBtn) consoleNavBtn.click();
      });
    }
  }

  initActionButtons() {
    // Quick Start
    const btnStart = document.getElementById('btn-quick-start');
    if (btnStart) {
      btnStart.addEventListener('click', async () => {
        try {
          this.showToast('Iniciando servidor de Project Zomboid...', 'info');
          const res = await API.startServer();
          if (res.success) {
            this.showToast('Proceso del servidor iniciado.', 'success');
          }
        } catch (err) {
          this.showToast(`Error al iniciar: ${err.message}`, 'error');
        }
      });
    }

    // Quick Stop
    const btnStop = document.getElementById('btn-quick-stop');
    if (btnStop) {
      btnStop.addEventListener('click', async () => {
        try {
          this.showToast('Deteniendo servidor de forma segura...', 'warn');
          const res = await API.stopServer(false);
          if (res.success) {
            this.showToast('Comando de parada enviado.', 'info');
          }
        } catch (err) {
          this.showToast(`Error al detener: ${err.message}`, 'error');
        }
      });
    }

    // Quick Restart
    const btnRestart = document.getElementById('btn-quick-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', async () => {
        try {
          this.showToast('Reiniciando servidor...', 'info');
          const res = await API.restartServer();
          if (res.success) {
            this.showToast('Servidor reiniciado.', 'success');
          }
        } catch (err) {
          this.showToast(`Error al reiniciar: ${err.message}`, 'error');
        }
      });
    }

    // Install Server
    const btnInstall = document.getElementById('btn-install-server');
    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        try {
          this.showToast('Iniciando instalación del servidor mediante SteamCMD...', 'info');
          await API.installServer();
        } catch (err) {
          this.showToast(`Error al instalar: ${err.message}`, 'error');
        }
      });
    }

    // Update Server
    const btnUpdate = document.getElementById('btn-update-server');
    if (btnUpdate) {
      btnUpdate.addEventListener('click', async () => {
        try {
          this.showToast('Comprobando actualizaciones con SteamCMD...', 'info');
          await API.updateServer();
        } catch (err) {
          this.showToast(`Error al actualizar: ${err.message}`, 'error');
        }
      });
    }

    // Validate Tool
    const btnValidate = document.getElementById('btn-tool-validate');
    if (btnValidate) {
      btnValidate.addEventListener('click', async () => {
        try {
          this.showToast('Validando archivos del servidor...', 'info');
          await API.updateServer();
        } catch (err) {
          this.showToast(`Error: ${err.message}`, 'error');
        }
      });
    }

    // Force Kill
    const btnKill = document.getElementById('btn-tool-kill');
    if (btnKill) {
      btnKill.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de forzar el cierre del servidor? Los datos no guardados podrían perderse.')) {
          try {
            await API.killServer();
            this.showToast('Proceso terminado forzosamente.', 'warn');
          } catch (err) {
            this.showToast(`Error: ${err.message}`, 'error');
          }
        }
      });
    }

    // Cancel SteamCMD
    const btnCancelSteam = document.getElementById('btn-cancel-steam');
    if (btnCancelSteam) {
      btnCancelSteam.addEventListener('click', async () => {
        await API.cancelSteam();
        this.showToast('Operación de Steam cancelada.', 'warn');
      });
    }
  }

  initWebSocketListeners() {
    wsClient.on('onStatus', (status) => {
      this.updateStatusUI(status);
    });

    wsClient.on('onMetrics', (metrics) => {
      this.updateMetricsUI(metrics);
    });
  }

  updateStatusUI(status) {
    this.status = status;
    const state = status.state || 'stopped';

    // Global Pill
    const pill = document.getElementById('global-status-pill');
    const pillText = document.getElementById('global-status-text');
    const cardText = document.getElementById('card-status-text');
    const cardSub = document.getElementById('card-status-sub');
    const pidText = document.getElementById('card-pid-text');
    const errorBanner = document.getElementById('server-error-banner');
    const errorText = document.getElementById('server-error-text');

    if (pill) {
      pill.className = `status-pill status-${state}`;
    }

    const stateLabels = {
      stopped: 'Detenido',
      starting: 'Iniciando...',
      running: 'En Ejecución',
      stopping: 'Deteniendo...',
      installing: 'Instalando Servidor',
      updating: 'Actualizando',
      downloading_steamcmd: 'Descargando SteamCMD',
      error: 'Error'
    };

    const label = stateLabels[state] || state;
    if (pillText) pillText.textContent = label;
    if (cardText) cardText.textContent = label;

    // Sub labels
    if (cardSub) {
      if (state === 'running') {
        cardSub.textContent = 'Servidor listo para conexiones';
      } else if (state === 'stopped') {
        cardSub.textContent = status.isInstalled ? 'Listo para iniciar' : 'Requiere instalación';
      } else if (state === 'starting') {
        cardSub.textContent = 'Cargando scripts y mapa...';
      } else if (state === 'stopping') {
        cardSub.textContent = 'Guardando mundo...';
      } else {
        cardSub.textContent = '-';
      }
    }

    if (pidText) {
      pidText.textContent = status.pid ? `PID: ${status.pid}` : 'PID: Inactivo';
    }

    // Error banner
    if (errorBanner && errorText) {
      if (status.lastError) {
        errorBanner.classList.remove('hidden');
        errorText.textContent = status.lastError;
      } else {
        errorBanner.classList.add('hidden');
      }
    }

    // Buttons Enable/Disable state
    const btnStart = document.getElementById('btn-quick-start');
    const btnStop = document.getElementById('btn-quick-stop');
    const btnRestart = document.getElementById('btn-quick-restart');

    if (btnStart) btnStart.disabled = (state === 'running' || state === 'starting' || state === 'installing' || state === 'updating');
    if (btnStop) btnStop.disabled = (state === 'stopped' || state === 'stopping' || state === 'installing' || state === 'updating');
    if (btnRestart) btnRestart.disabled = (state === 'stopped' || state === 'installing' || state === 'updating');

    // Steam Banner
    const steamBanner = document.getElementById('steam-banner');
    const steamTitle = document.getElementById('steam-banner-title');
    const steamStatus = document.getElementById('steam-banner-status');
    const steamProgress = document.getElementById('steam-banner-progress');

    if (steamBanner && (state === 'installing' || state === 'updating' || state === 'downloading_steamcmd')) {
      steamBanner.classList.remove('hidden');
      if (status.steamProgress) {
        if (steamTitle) steamTitle.textContent = label;
        if (steamStatus) steamStatus.textContent = status.steamProgress.statusText || 'Procesando...';
        if (steamProgress) steamProgress.style.width = `${status.steamProgress.percent || 0}%`;
      }
    } else if (steamBanner) {
      steamBanner.classList.add('hidden');
    }

    // Uptime formatting
    this.updateUptimeUI(status.uptime);
  }

  updateUptimeUI(seconds) {
    const uptimeEl = document.getElementById('card-uptime-text');
    if (!uptimeEl) return;

    if (!seconds || seconds <= 0) {
      uptimeEl.textContent = '00:00:00';
      return;
    }

    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    uptimeEl.textContent = `${h}:${m}:${s}`;
  }

  updateMetricsUI(metrics) {
    if (!metrics) return;

    // CPU
    const cpuBar = document.getElementById('cpu-bar');
    const cpuVal = document.getElementById('cpu-val');
    if (cpuBar) cpuBar.style.width = `${metrics.cpuUsage || 0}%`;
    if (cpuVal) cpuVal.textContent = `${metrics.cpuUsage || 0}%`;

    // System RAM
    const ramBar = document.getElementById('ram-bar');
    const ramVal = document.getElementById('ram-val');
    if (ramBar) ramBar.style.width = `${metrics.memoryUsagePercent || 0}%`;
    if (ramVal) ramVal.textContent = `${metrics.usedMemoryGB} / ${metrics.totalMemoryGB} GB`;

    // PZ Process RAM
    const procRamVal = document.getElementById('proc-ram-val');
    if (procRamVal) {
      if (metrics.processMetrics && metrics.processMetrics.memoryFormatted) {
        procRamVal.textContent = metrics.processMetrics.memoryFormatted;
      } else {
        procRamVal.textContent = '0 MB';
      }
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new AppManager();
});
