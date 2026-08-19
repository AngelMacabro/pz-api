const os = require('os');
const { exec } = require('child_process');

class SystemService {
  constructor() {
    this.previousCpuTimes = this.getCpuTimes();
  }

  getCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }
    return { idle, total };
  }

  getCpuUsage() {
    const currentTimes = this.getCpuTimes();
    const idleDiff = currentTimes.idle - this.previousCpuTimes.idle;
    const totalDiff = currentTimes.total - this.previousCpuTimes.total;
    this.previousCpuTimes = currentTimes;

    if (totalDiff === 0) return 0;
    const usage = 100 - Math.round((100 * idleDiff) / totalDiff);
    return Math.max(0, Math.min(100, usage));
  }

  getSystemMetrics(pzPid = null) {
    return new Promise((resolve) => {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = Math.round((usedMem / totalMem) * 100);

      const metrics = {
        cpuUsage: this.getCpuUsage(),
        totalMemoryBytes: totalMem,
        freeMemoryBytes: freeMem,
        usedMemoryBytes: usedMem,
        memoryUsagePercent: memUsagePercent,
        totalMemoryGB: (totalMem / (1024 ** 3)).toFixed(1),
        usedMemoryGB: (usedMem / (1024 ** 3)).toFixed(1),
        freeMemoryGB: (freeMem / (1024 ** 3)).toFixed(1),
        uptimeSeconds: os.uptime(),
        hostname: os.hostname(),
        platform: os.platform(),
        processMetrics: null
      };

      if (!pzPid) {
        return resolve(metrics);
      }

      // Query process memory on Windows using tasklist
      exec(`tasklist /FI "PID eq ${pzPid}" /FO CSV /NH`, (err, stdout) => {
        if (!err && stdout && stdout.includes(String(pzPid))) {
          try {
            // Format: "imagename.exe","PID","Session Name","Session#","Mem Usage"
            const parts = stdout.trim().split('","');
            if (parts.length >= 5) {
              const memStr = parts[4].replace(/[^0-9]/g, '');
              const memKB = parseInt(memStr, 10) || 0;
              metrics.processMetrics = {
                pid: pzPid,
                memoryBytes: memKB * 1024,
                memoryMB: Math.round(memKB / 1024),
                memoryFormatted: `${Math.round(memKB / 1024)} MB`
              };
            }
          } catch (e) {
            // ignore parsing error
          }
        }
        resolve(metrics);
      });
    });
  }
}

module.exports = new SystemService();
