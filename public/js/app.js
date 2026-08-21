/**
 * Main Application Orchestrator with Auth & RBAC
 */
class AppManager {
  constructor() {
    this.status = { state: 'stopped', pid: null, uptime: 0 };
    this.uptimeInterval = null;
    this.init();
  }

  async init() {
    // Global reference for toast & controllers
    window.App = this;

    this.initTabs();
    this.initActionButtons();
    this.initAuthUI();
    this.initWebSocketListeners();

    // Controllers
    this.consoleCtrl = new ConsoleController();
    this.configCtrl = new ConfigViewController();
    this.modCtrl = new ModViewController();
    this.fileEditorCtrl = new FileEditorController();
    this.userMgmtCtrl = new UserManagementController();

    // Check user session
    const isAuth = await authManager.init();
    if (isAuth) {
      wsClient.connect();
    } else {
      authManager.showLoginModal();
    }
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
        } else if (targetTabId === 'tab-users' && this.userMgmtCtrl) {
          this.userMgmtCtrl.loadAll();
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

  initAuthUI() {
    // Guest Login Button
    const btnGuestLogin = document.getElementById('btn-guest-login');
    if (btnGuestLogin) {
      btnGuestLogin.addEventListener('click', () => authManager.showLoginModal());
    }

    // User Logout Button
    const btnLogout = document.getElementById('btn-user-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => authManager.logout());
    }

    // Auth Modal Tabs (Login vs Register)
    const tabLoginBtn = document.getElementById('tab-btn-login');
    const tabRegisterBtn = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tabLoginBtn && tabRegisterBtn && formLogin && formRegister) {
      tabLoginBtn.addEventListener('click', () => {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
      });

      tabRegisterBtn.addEventListener('click', () => {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        formRegister.classList.remove('hidden');
        formLogin.classList.add('hidden');
      });
    }

    // Login Form Submit
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('input-login-username')?.value.trim();
        const password = document.getElementById('input-login-password')?.value;
        const errBox = document.getElementById('login-error-msg');

        if (errBox) errBox.classList.add('hidden');

        try {
          await authManager.login(username, password);
          authManager.hideLoginModal();
          this.showToast(`¡Bienvenido, ${authManager.currentUser.username}!`, 'success');
          wsClient.connect();
        } catch (err) {
          if (errBox) {
            errBox.textContent = err.message || 'Error al iniciar sesión';
            errBox.classList.remove('hidden');
          }
        }
      });
    }

    // Register Form Submit
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('input-reg-username')?.value.trim();
        const email = document.getElementById('input-reg-email')?.value.trim();
        const password = document.getElementById('input-reg-password')?.value;
        const errBox = document.getElementById('reg-error-msg');

        if (errBox) errBox.classList.add('hidden');

        try {
          await authManager.register(username, email, password);
          authManager.hideLoginModal();
          this.showToast('Cuenta creada e iniciada exitosamente', 'success');
          wsClient.connect();
        } catch (err) {
          if (errBox) {
            errBox.textContent = err.message || 'Error al registrar usuario';
            errBox.classList.remove('hidden');
          }
        }
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

    // Uptime Counter
    const uptimeEl = document.getElementById('card-uptime-text');
    if (uptimeEl) {
      const uptimeSecs = status.uptime || 0;
      if (uptimeSecs > 0 && state === 'running') {
        const hrs = Math.floor(uptimeSecs / 3600).toString().padStart(2, '0');
        const mins = Math.floor((uptimeSecs % 3600) / 60).toString().padStart(2, '0');
        const secs = (uptimeSecs % 60).toString().padStart(2, '0');
        uptimeEl.textContent = `${hrs}:${mins}:${secs}`;
      } else {
        uptimeEl.textContent = '00:00:00';
      }
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

    const isRunning = state === 'running';
    const isStopped = state === 'stopped';
    const isBusy = ['starting', 'stopping', 'installing', 'updating', 'downloading_steamcmd'].includes(state);

    if (btnStart) btnStart.disabled = !isStopped;
    if (btnStop) btnStop.disabled = !isRunning;
    if (btnRestart) btnRestart.disabled = !isRunning;

    // Steam Banner
    const steamBanner = document.getElementById('steam-banner');
    const steamStatus = document.getElementById('steam-banner-status');
    const steamProgress = document.getElementById('steam-banner-progress');

    if (['installing', 'updating', 'downloading_steamcmd'].includes(state)) {
      if (steamBanner) steamBanner.classList.remove('hidden');
      if (steamStatus) steamStatus.textContent = status.steamStatus || 'Procesando descarga de archivos...';
      if (steamProgress && status.steamProgress) {
        steamProgress.style.width = `${status.steamProgress}%`;
      }
    } else {
      if (steamBanner) steamBanner.classList.add('hidden');
    }
  }

  updateMetricsUI(metrics) {
    if (!metrics) return;

    // System CPU
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
