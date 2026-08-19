const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn, exec } = require('child_process');
const configManager = require('../config/configManager');
const logService = require('./logService');

class SteamCmdService {
  constructor() {
    this.currentProcess = null;
    this.isBusy = false;
    this.currentAction = null; // 'installing' | 'updating' | 'downloading_steamcmd'
    this.progress = { percent: 0, statusText: '', stage: '' };
  }

  getSteamCmdPath() {
    const steamDir = configManager.get('steamCmdDir');
    return path.join(steamDir, 'steamcmd.exe');
  }

  isInstalled() {
    return fs.existsSync(this.getSteamCmdPath());
  }

  async ensureSteamCmd() {
    if (this.isInstalled()) {
      return true;
    }

    const steamDir = configManager.get('steamCmdDir');
    if (!fs.existsSync(steamDir)) {
      fs.mkdirSync(steamDir, { recursive: true });
    }

    const zipPath = path.join(steamDir, 'steamcmd.zip');
    logService.log('SteamCMD no encontrado. Iniciando descarga automática...', 'system', 'steamcmd');
    this.isBusy = true;
    this.currentAction = 'downloading_steamcmd';
    this.progress = { percent: 10, statusText: 'Descargando SteamCMD...', stage: 'download' };

    try {
      await this.downloadFile('https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip', zipPath);
      logService.log('SteamCMD descargado. Descomprimiendo...', 'system', 'steamcmd');
      this.progress = { percent: 60, statusText: 'Descomprimiendo SteamCMD...', stage: 'extract' };

      await this.extractZip(zipPath, steamDir);
      
      // Clean up zip
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch (e) {
        // ignore
      }

      logService.log('SteamCMD instalado correctamente en: ' + steamDir, 'success', 'steamcmd');
      this.isBusy = false;
      this.currentAction = null;
      this.progress = { percent: 100, statusText: 'SteamCMD listo', stage: 'complete' };
      return true;
    } catch (err) {
      this.isBusy = false;
      this.currentAction = null;
      logService.log(`Error al descargar/descomprimir SteamCMD: ${err.message}`, 'error', 'steamcmd');
      throw err;
    }
  }

  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          return resolve(this.downloadFile(response.headers.location, dest));
        }

        if (response.statusCode !== 200) {
          file.close();
          return reject(new Error(`HTTP status code ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }

  extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
      // Use PowerShell Expand-Archive built into Windows 11
      const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message));
        }
        resolve();
      });
    });
  }

  async installOrUpdateServer(isUpdate = false) {
    if (this.isBusy) {
      throw new Error('SteamCMD ya está realizando una operación.');
    }

    await this.ensureSteamCmd();

    const steamCmdExe = this.getSteamCmdPath();
    const serverInstallDir = configManager.get('serverInstallDir');
    const appId = configManager.get('appId') || '380870';
    const branch = configManager.get('branch');
    const branchPassword = configManager.get('branchPassword');
    const validate = configManager.get('validateFiles');

    // Ensure server install directory exists
    if (!fs.existsSync(serverInstallDir)) {
      fs.mkdirSync(serverInstallDir, { recursive: true });
    }

    this.isBusy = true;
    this.currentAction = isUpdate ? 'updating' : 'installing';
    this.progress = {
      percent: 0,
      statusText: isUpdate ? 'Iniciando actualización del servidor...' : 'Iniciando instalación del servidor...',
      stage: 'init'
    };

    logService.log(`=== ${isUpdate ? 'ACTUALIZACIÓN' : 'INSTALACIÓN'} DEL SERVIDOR (AppID: ${appId}) ===`, 'system', 'steamcmd');
    logService.log(`Directorio destino: ${serverInstallDir}`, 'system', 'steamcmd');
    if (branch) {
      logService.log(`Rama seleccionada: -beta ${branch}`, 'system', 'steamcmd');
    }

    // Build SteamCMD args
    const args = [
      '+force_install_dir', serverInstallDir,
      '+login', 'anonymous'
    ];

    let appUpdateCmd = `+app_update ${appId}`;
    if (branch && branch.trim().length > 0) {
      appUpdateCmd += ` -beta ${branch.trim()}`;
      if (branchPassword && branchPassword.trim().length > 0) {
        appUpdateCmd += ` -betapassword ${branchPassword.trim()}`;
      }
    }
    if (validate) {
      appUpdateCmd += ' validate';
    }

    args.push(appUpdateCmd);
    args.push('+quit');

    return new Promise((resolve, reject) => {
      try {
        this.currentProcess = spawn(steamCmdExe, args, {
          windowsHide: true,
          cwd: path.dirname(steamCmdExe)
        });

        this.currentProcess.stdout.on('data', (data) => {
          const text = data.toString('utf-8');
          logService.log(text, 'steamcmd', 'steamcmd');
          this.parseSteamOutput(text);
        });

        this.currentProcess.stderr.on('data', (data) => {
          const text = data.toString('utf-8');
          logService.log(text, 'warn', 'steamcmd');
        });

        this.currentProcess.on('close', (code) => {
          this.isBusy = false;
          this.currentProcess = null;
          const wasAction = this.currentAction;
          this.currentAction = null;

          if (code === 0 || code === 7 /* SteamCMD sometimes exits with 7 on completion */) {
            this.progress = { percent: 100, statusText: 'Completado con éxito.', stage: 'finished' };
            logService.log(`=== ${isUpdate ? 'ACTUALIZACIÓN' : 'INSTALACIÓN'} COMPLETADA CON ÉXITO ===`, 'success', 'steamcmd');
            resolve({ success: true, code });
          } else {
            this.progress = { percent: 0, statusText: `Falló con código ${code}`, stage: 'error' };
            logService.log(`SteamCMD finalizó con código de salida: ${code}`, 'error', 'steamcmd');
            reject(new Error(`SteamCMD finalizó con código ${code}`));
          }
        });

        this.currentProcess.on('error', (err) => {
          this.isBusy = false;
          this.currentAction = null;
          this.currentProcess = null;
          this.progress = { percent: 0, statusText: err.message, stage: 'error' };
          logService.log(`Error al ejecutar SteamCMD: ${err.message}`, 'error', 'steamcmd');
          reject(err);
        });
      } catch (err) {
        this.isBusy = false;
        this.currentAction = null;
        this.currentProcess = null;
        reject(err);
      }
    });
  }

  parseSteamOutput(text) {
    // Look for progress like: "Update state (0x3) downloading, progress: 45.23 (1024 / 2048)"
    const match = text.match(/progress:\s*([0-9.]+)\s*\(([^)]+)\)/i);
    if (match) {
      const percent = parseFloat(match[1]);
      const details = match[2];
      this.progress = {
        percent: Math.min(100, Math.max(0, percent)),
        statusText: `Descargando... ${percent.toFixed(1)}% (${details})`,
        stage: 'downloading'
      };
    } else if (text.includes('Verifying installation')) {
      this.progress = {
        percent: 90,
        statusText: 'Verificando integridad de archivos...',
        stage: 'verifying'
      };
    } else if (text.includes('Success! App')) {
      this.progress = {
        percent: 100,
        statusText: 'Servidor instalado y validado.',
        stage: 'complete'
      };
    }
  }

  async downloadWorkshopMods(workshopIds = null) {
    if (this.isBusy) {
      throw new Error('SteamCMD ya está realizando una operación.');
    }

    await this.ensureSteamCmd();

    const steamCmdExe = this.getSteamCmdPath();
    const serverInstallDir = configManager.get('serverInstallDir');

    let ids = workshopIds;
    if (!ids || ids.length === 0) {
      const modService = require('./modService');
      const modData = modService.getMods();
      ids = modData.workshopItems;
    }

    if (!ids || ids.length === 0) {
      throw new Error('No hay Workshop Items configurados para descargar.');
    }

    const cleanIds = [...new Set(ids.map(s => String(s).trim()).filter(s => /^[0-9]+$/.test(s)))];
    
    this.isBusy = true;
    this.currentAction = 'updating';
    this.progress = {
      percent: 0,
      statusText: `Iniciando descarga de ${cleanIds.length} mods de Steam Workshop...`,
      stage: 'mods'
    };

    logService.log(`=== DESCARGANDO ${cleanIds.length} MODS DE STEAM WORKSHOP ===`, 'system', 'steamcmd');

    const args = [
      '+force_install_dir', serverInstallDir,
      '+login', 'anonymous'
    ];

    for (const id of cleanIds) {
      args.push('+workshop_download_item', '108600', id);
    }
    args.push('+quit');

    return new Promise((resolve, reject) => {
      try {
        this.currentProcess = spawn(steamCmdExe, args, {
          windowsHide: true,
          cwd: path.dirname(steamCmdExe)
        });

        let downloadedCount = 0;

        this.currentProcess.stdout.on('data', (data) => {
          const text = data.toString('utf-8');
          logService.log(text, 'steamcmd', 'steamcmd');
          
          if (text.includes('Success. Downloaded item')) {
            downloadedCount++;
            const pct = Math.round((downloadedCount / cleanIds.length) * 100);
            this.progress = {
              percent: pct,
              statusText: `Descargado mod ${downloadedCount}/${cleanIds.length} (${pct}%)`,
              stage: 'mods_downloading'
            };
          }
        });

        this.currentProcess.stderr.on('data', (data) => {
          const text = data.toString('utf-8');
          logService.log(text, 'warn', 'steamcmd');
        });

        this.currentProcess.on('close', (code) => {
          this.isBusy = false;
          this.currentProcess = null;
          this.currentAction = null;
          logService.log(`=== DESCARGA DE MODS FINALIZADA (Código: ${code}) ===`, 'success', 'steamcmd');
          resolve({ success: true, code, total: cleanIds.length });
        });

        this.currentProcess.on('error', (err) => {
          this.isBusy = false;
          this.currentProcess = null;
          this.currentAction = null;
          logService.log(`Error descargando mods: ${err.message}`, 'error', 'steamcmd');
          reject(err);
        });
      } catch (err) {
        this.isBusy = false;
        this.currentAction = null;
        this.currentProcess = null;
        reject(err);
      }
    });
  }

  cancel() {
    if (this.currentProcess) {
      try {
        // Kill the SteamCMD process tree
        exec(`taskkill /pid ${this.currentProcess.pid} /T /F`);
        this.isBusy = false;
        this.currentAction = null;
        this.currentProcess = null;
        logService.log('Operación de SteamCMD cancelada por el usuario.', 'warn', 'steamcmd');
        return true;
      } catch (err) {
        logService.log(`Error al cancelar SteamCMD: ${err.message}`, 'error', 'steamcmd');
        return false;
      }
    }
    return false;
  }

  getStatus() {
    return {
      isInstalled: this.isInstalled(),
      steamCmdPath: this.getSteamCmdPath(),
      isBusy: this.isBusy,
      currentAction: this.currentAction,
      progress: this.progress
    };
  }
}

module.exports = new SteamCmdService();
