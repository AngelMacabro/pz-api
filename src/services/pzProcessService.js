const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const configManager = require('../config/configManager');
const logService = require('./logService');
const steamcmdService = require('./steamcmdService');

class PzProcessService {
  constructor() {
    this.process = null;
    this.pid = null;
    this.state = 'stopped'; // 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
    this.startTime = null;
    this.lastError = null;
    this.stopTimeout = null;
    this.restartAttempts = 0;
  }

  isServerInstalled() {
    const installDir = configManager.get('serverInstallDir');
    const javaExe = path.join(installDir, 'jre64', 'bin', 'java.exe');
    const batFile = path.join(installDir, 'StartServer64.bat');
    const batFileAlt = path.join(installDir, 'ProjectZomboidServer.bat');
    const jarFile = path.join(installDir, 'java', 'projectzomboid.jar');
    const jarFileRoot = path.join(installDir, 'projectzomboid.jar');

    const hasJava = fs.existsSync(javaExe);
    const hasJar = fs.existsSync(jarFile) || fs.existsSync(jarFileRoot);
    const hasBat = fs.existsSync(batFile) || fs.existsSync(batFileAlt);

    return (hasJava && hasJar) || hasBat;
  }

  getState() {
    // If SteamCMD is currently doing work, show that state
    if (steamcmdService.isBusy) {
      return {
        state: steamcmdService.currentAction,
        isInstalled: this.isServerInstalled(),
        pid: null,
        uptime: 0,
        lastError: this.lastError,
        startTime: null,
        steamProgress: steamcmdService.progress
      };
    }

    const uptime = this.startTime && this.state === 'running'
      ? Math.floor((Date.now() - this.startTime) / 1000)
      : 0;

    return {
      state: this.state,
      isInstalled: this.isServerInstalled(),
      pid: this.pid,
      uptime,
      lastError: this.lastError,
      startTime: this.startTime,
      steamProgress: null
    };
  }

  ensureSteamLibraryStructure() {
    const installDir = configManager.get('serverInstallDir');
    const cacheDir = configManager.get('cacheDir');
    
    // Windows escaped path: G:\\pzserver\\pz_dedicated_server
    const escapedInstallDir = installDir.replace(/\\/g, '\\\\');

    const vdfContent = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"${escapedInstallDir}"
\t\t"label"\t\t""
\t\t"apps"
\t\t{
\t\t\t"380870"\t\t"0"
\t\t\t"108600"\t\t"0"
\t\t}
\t}
}
`;

    // 1. Create steamapps and config folders with libraryfolders.vdf
    const pathsToCreateVdf = [
      path.join(installDir, 'steamapps'),
      path.join(installDir, 'config')
    ];

    for (const dir of pathsToCreateVdf) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'libraryfolders.vdf'), vdfContent, 'utf-8');
      } catch (e) {
        // ignore
      }
    }

    // 2. Create required workshop subfolders
    const workshopDirs = [
      path.join(installDir, 'steamapps', 'downloading'),
      path.join(installDir, 'steamapps', 'temp'),
      path.join(installDir, 'steamapps', 'workshop'),
      path.join(installDir, 'steamapps', 'workshop', 'content'),
      path.join(installDir, 'steamapps', 'workshop', 'content', '108600'),
      path.join(installDir, 'steamapps', 'workshop', 'downloads'),
      path.join(installDir, 'steamapps', 'workshop', 'temp')
    ];

    if (cacheDir) {
      workshopDirs.push(
        path.join(cacheDir, 'Workshop'),
        path.join(cacheDir, 'Workshop', 'steamapps'),
        path.join(cacheDir, 'Workshop', 'steamapps', 'workshop'),
        path.join(cacheDir, 'Workshop', 'steamapps', 'workshop', 'content'),
        path.join(cacheDir, 'Workshop', 'steamapps', 'workshop', 'content', '108600'),
        path.join(cacheDir, 'Workshop', 'steamapps', 'workshop', 'temp')
      );
    }

    for (const d of workshopDirs) {
      try {
        if (!fs.existsSync(d)) {
          fs.mkdirSync(d, { recursive: true });
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Synchronize appworkshop_108600.acf WorkshopItemsInstalled from WorkshopItemDetails
    try {
      const acfPath = path.join(installDir, 'steamapps', 'workshop', 'appworkshop_108600.acf');
      if (fs.existsSync(acfPath)) {
        let acf = fs.readFileSync(acfPath, 'utf-8');
        const detailsIdx = acf.indexOf('"WorkshopItemDetails"');
        if (detailsIdx !== -1) {
          const detailsContent = acf.substring(detailsIdx);
          const itemRegex = /"([0-9]+)"\s*\{([^}]*)\}/g;
          let match;
          let installedEntries = '';

          while ((match = itemRegex.exec(detailsContent)) !== null) {
            const id = match[1];
            const block = match[2];
            const manifestM = block.match(/"manifest"\s*"([^"]+)"/);
            const timeM = block.match(/"timeupdated"\s*"([^"]+)"/);
            const sizeM = block.match(/"size"\s*"([^"]+)"/);

            const manifest = manifestM ? manifestM[1] : '1';
            const timeupdated = timeM ? timeM[1] : '0';
            const size = sizeM ? sizeM[1] : '100000';

            installedEntries += `\t\t"${id}"\n\t\t{\n\t\t\t"size"\t\t"${size}"\n\t\t\t"timeupdated"\t\t"${timeupdated}"\n\t\t\t"manifest"\t\t"${manifest}"\n\t\t}\n`;
          }

          if (installedEntries.length > 0) {
            const newInstalledBlock = `\t"WorkshopItemsInstalled"\n\t{\n${installedEntries}\t}\n`;
            if (acf.includes('"WorkshopItemsInstalled"')) {
              acf = acf.replace(/"WorkshopItemsInstalled"\s*\{[\s\S]*?\n\t\}/, `\t"WorkshopItemsInstalled"\n\t{\n${installedEntries}\t}`);
            } else {
              acf = acf.replace('"WorkshopItemDetails"', `${newInstalledBlock}\t"WorkshopItemDetails"`);
            }

            fs.writeFileSync(acfPath, acf, 'utf-8');
            const rootAcf = path.join(installDir, 'steamapps', 'appworkshop_108600.acf');
            fs.writeFileSync(rootAcf, acf, 'utf-8');
          }
        }
      }
    } catch (err) {
      console.error('[ensureSteamLibraryStructure] Error updating appworkshop.acf:', err.message);
    }
  }

  async start() {
    if (this.state === 'running' || this.state === 'starting') {
      throw new Error('El servidor ya se encuentra en ejecución o iniciando.');
    }

    if (steamcmdService.isBusy) {
      throw new Error('SteamCMD está en ejecución. Espera a que termine.');
    }

    const installDir = configManager.get('serverInstallDir');
    if (!this.isServerInstalled()) {
      throw new Error(`El servidor no está instalado en: ${installDir}. Por favor ejecuta la instalación primero.`);
    }

    // Ensure Steam Workshop directory structure & libraryfolders.vdf exist
    this.ensureSteamLibraryStructure();

    this.state = 'starting';
    this.lastError = null;
    this.startTime = Date.now();

    const serverName = configManager.get('serverName') || 'servertest';
    const minRam = configManager.get('minRam') || '2048m';
    const maxRam = configManager.get('maxRam') || '6144m';
    const cacheDir = configManager.get('cacheDir');
    const adminPassword = configManager.get('adminPassword');
    const jvmArgs = configManager.get('jvmArgs') || '-XX:+UseZGC -XX:-CreateCoredumpOnCrash -XX:-OmitStackTraceInFastThrow';

    logService.log(`=== INICIANDO SERVIDOR PROJECT ZOMBOID BUILD 42 (${serverName}) ===`, 'system', 'server');
    logService.log(`RAM: Min ${minRam} / Max ${maxRam} | Directorio: ${installDir}`, 'system', 'server');

    const javaExe = path.join(installDir, 'jre64', 'bin', 'java.exe');
    const jarFileSub = path.join(installDir, 'java', 'projectzomboid.jar');
    const jarFileRoot = path.join(installDir, 'projectzomboid.jar');

    let executable = '';
    let args = [];

    if (fs.existsSync(javaExe) && (fs.existsSync(jarFileSub) || fs.existsSync(jarFileRoot))) {
      executable = javaExe;
      
      // Parse custom JVM args
      const parsedJvmArgs = jvmArgs.split(' ').map(s => s.trim()).filter(s => s.length > 0);
      
      args = [
        '-Djava.awt.headless=true',
        '-Dzomboid.steam=1',
        '-Dzomboid.znetlog=1',
        `--enable-native-access=ALL-UNNAMED`,
        `--add-exports=java.base/jdk.internal.misc=ALL-UNNAMED`,
        `-Xms${minRam}`,
        `-Xmx${maxRam}`,
        ...parsedJvmArgs,
        '-Djava.library.path=natives/;./natives/;./natives/win64/;./',
        '-cp', 'java/;java/projectzomboid.jar;./;projectzomboid.jar',
        'zombie.network.GameServer',
        '-servername', serverName
      ];

      if (cacheDir && cacheDir.trim().length > 0) {
        args.push(`-cachedir=${cacheDir.trim()}`);
      }

      if (adminPassword && adminPassword.trim().length > 0) {
        args.push('-adminpassword', adminPassword.trim());
      }
    } else {
      // Fallback to StartServer64.bat or ProjectZomboidServer.bat
      const batFile = fs.existsSync(path.join(installDir, 'StartServer64.bat'))
        ? path.join(installDir, 'StartServer64.bat')
        : path.join(installDir, 'ProjectZomboidServer.bat');

      executable = 'cmd.exe';
      args = ['/c', batFile, '-servername', serverName];
      if (cacheDir) args.push(`-cachedir=${cacheDir}`);
    }

    try {
      this.process = spawn(executable, args, {
        cwd: installDir,
        windowsHide: true,
        env: { ...process.env }
      });

      this.pid = this.process.pid;
      logService.log(`Proceso del servidor iniciado (PID: ${this.pid})`, 'system', 'server');

      this.process.stdout.on('data', (data) => {
        const text = data.toString('utf-8');
        logService.log(text, 'stdout', 'server');
        this.parseServerOutput(text);
      });

      this.process.stderr.on('data', (data) => {
        const text = data.toString('utf-8');
        logService.log(text, 'stderr', 'server');
        this.detectErrors(text);
      });

      this.process.on('close', (code, signal) => {
        const previousState = this.state;
        this.state = 'stopped';
        this.pid = null;
        this.process = null;

        logService.log(`Servidor detenido. Código de salida: ${code} (Señal: ${signal || 'none'})`, 'system', 'server');

        if (code !== 0 && previousState !== 'stopping') {
          this.state = 'error';
          this.lastError = `El servidor se cerró de forma inesperada (Código: ${code})`;
          this.checkAutoRestart();
        }
      });

      this.process.on('error', (err) => {
        this.state = 'error';
        this.lastError = err.message;
        this.pid = null;
        this.process = null;
        logService.log(`Error en el proceso del servidor: ${err.message}`, 'error', 'server');
      });

      return { success: true, pid: this.pid };
    } catch (err) {
      this.state = 'error';
      this.lastError = err.message;
      logService.log(`No se pudo iniciar el proceso del servidor: ${err.message}`, 'error', 'server');
      throw err;
    }
  }

  parseServerOutput(text) {
    // Detect server ready
    if (
      text.includes('*** SERVER STARTED ****') ||
      text.includes('*** SERVER STARTED ***') ||
      text.includes('Steam is ready') ||
      text.includes('RakNet.Startup()') ||
      text.includes('Server is listening')
    ) {
      if (this.state !== 'running') {
        this.state = 'running';
        this.restartAttempts = 0;
        logService.log('>>> ¡SERVIDOR DE PROJECT ZOMBOID INICIADO Y LISTO PARA JUGADORES! <<<', 'success', 'server');
      }
    }

    this.detectErrors(text);
  }

  detectErrors(text) {
    if (text.includes('OutOfMemoryError') || text.includes('Could not reserve enough space')) {
      const msg = 'ERROR DE MEMORIA: Java se quedó sin memoria RAM. Ajusta los parámetros de RAM en la configuración.';
      this.lastError = msg;
      logService.log(msg, 'error', 'server');
    } else if (text.includes('Address already in use') || text.includes('BindException')) {
      const msg = 'ERROR DE PUERTOS: Los puertos 16261/16262 ya están en uso por otra aplicación o servidor.';
      this.lastError = msg;
      logService.log(msg, 'error', 'server');
    } else if (text.includes('Workshop item') && text.includes('not found')) {
      logService.log('ADVERTENCIA: Un mod del Workshop no pudo ser descargado o no se encontró.', 'warn', 'server');
    } else if (text.includes('Lock file found') || text.includes('database is locked')) {
      const msg = 'ADVERTENCIA: El archivo de base de datos o mundo está bloqueado por otra instancia.';
      logService.log(msg, 'warn', 'server');
    }
  }

  checkAutoRestart() {
    const autoRestart = configManager.get('autoRestartOnCrash');
    if (autoRestart && this.restartAttempts < 3) {
      this.restartAttempts++;
      logService.log(`Reinicio automático activado. Reintentando iniciar servidor (Intento ${this.restartAttempts}/3 en 5s)...`, 'warn', 'server');
      setTimeout(() => {
        if (this.state === 'error' || this.state === 'stopped') {
          this.start().catch(() => {});
        }
      }, 5000);
    }
  }

  async stop(force = false) {
    if (!this.process || this.state === 'stopped') {
      this.state = 'stopped';
      this.pid = null;
      return { success: true, message: 'El servidor ya está detenido.' };
    }

    if (force) {
      return this.kill();
    }

    this.state = 'stopping';
    logService.log('Enviando comandos de guardado y cierre seguro (save & quit) al servidor...', 'system', 'server');

    try {
      if (this.process.stdin && !this.process.stdin.destroyed) {
        this.process.stdin.write('save\r\n');
        setTimeout(() => {
          if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
            this.process.stdin.write('quit\r\n');
          }
        }, 1500);
      }

      // Set safety timeout of 25 seconds for force kill fallback
      if (this.stopTimeout) clearTimeout(this.stopTimeout);
      this.stopTimeout = setTimeout(() => {
        if (this.process && this.state === 'stopping') {
          logService.log('El servidor no respondió al cierre seguro dentro del límite. Forzando terminación...', 'warn', 'server');
          this.kill();
        }
      }, 25000);

      return { success: true, message: 'Comando de apagado enviado.' };
    } catch (err) {
      logService.log(`Error al enviar comando de apagado: ${err.message}`, 'error', 'server');
      return this.kill();
    }
  }

  async restart() {
    logService.log('Reiniciando servidor...', 'system', 'server');
    if (this.state === 'running' || this.state === 'starting') {
      await this.stop(false);
      // Wait for process to exit
      let attempts = 0;
      while (this.process && attempts < 30) {
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
      }
    }
    return this.start();
  }

  kill() {
    if (this.pid) {
      logService.log(`Forzando terminación del proceso (PID: ${this.pid})...`, 'warn', 'server');
      try {
        exec(`taskkill /pid ${this.pid} /T /F`, () => {
          this.state = 'stopped';
          this.pid = null;
          this.process = null;
        });
      } catch (e) {
        try {
          this.process.kill('SIGKILL');
        } catch (err) {
          // ignore
        }
      }
    }
    this.state = 'stopped';
    this.pid = null;
    this.process = null;
    return { success: true, message: 'Proceso terminado forzosamente.' };
  }

  sendCommand(command) {
    if (!this.process || this.state !== 'running') {
      throw new Error('El servidor no está en ejecución. No se pueden enviar comandos.');
    }

    const cleanCommand = String(command).trim();
    if (!cleanCommand) {
      throw new Error('El comando no puede estar vacío.');
    }

    logService.log(`> ${cleanCommand}`, 'system', 'server');
    this.process.stdin.write(cleanCommand + '\r\n');
    return { success: true, command: cleanCommand };
  }
}

module.exports = new PzProcessService();
