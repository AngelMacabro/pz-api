/**
 * Config File Editor Controller
 */
class FileEditorController {
  constructor() {
    this.selectFile = document.getElementById('select-config-file');
    this.btnReload = document.getElementById('btn-reload-file');
    this.btnSave = document.getElementById('btn-save-raw-file');
    this.txtContent = document.getElementById('raw-file-content');
    this.pathDisplay = document.getElementById('editor-active-filepath');
    this.statusBadge = document.getElementById('editor-file-status');

    this.currentPath = null;
    this.files = [];

    this.init();
  }

  init() {
    if (this.selectFile) {
      this.selectFile.addEventListener('change', () => {
        this.loadFile(this.selectFile.value);
      });
    }

    if (this.btnReload) {
      this.btnReload.addEventListener('click', () => {
        if (this.currentPath) this.loadFile(this.currentPath);
      });
    }

    if (this.btnSave) {
      this.btnSave.addEventListener('click', () => {
        this.saveFile();
      });
    }

    this.loadFilesList();
  }

  async loadFilesList() {
    try {
      const res = await API.getFilesList();
      if (!res.success) return;

      this.files = res.files || [];
      if (this.selectFile) {
        this.selectFile.innerHTML = '';
        this.files.forEach((f) => {
          const opt = document.createElement('option');
          opt.value = f.path;
          opt.textContent = `${f.label} (${f.name})`;
          this.selectFile.appendChild(opt);
        });

        if (this.files.length > 0) {
          this.loadFile(this.files[0].path);
        }
      }
    } catch (err) {
      console.error('[FileEditor] Error loading files list:', err);
    }
  }

  async loadFile(filePath) {
    if (!filePath) return;
    this.currentPath = filePath;

    if (this.pathDisplay) this.pathDisplay.textContent = filePath;
    if (this.statusBadge) this.statusBadge.textContent = 'Cargando...';

    try {
      const res = await API.readFile(filePath);
      if (res.success && this.txtContent) {
        this.txtContent.value = res.content || '';
        if (this.statusBadge) this.statusBadge.textContent = 'Listo';
      }
    } catch (err) {
      if (this.statusBadge) this.statusBadge.textContent = 'Error al leer';
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error al leer archivo: ${err.message}`, 'error');
      }
    }
  }

  async saveFile() {
    if (!this.currentPath || !this.txtContent) return;

    if (this.statusBadge) this.statusBadge.textContent = 'Guardando...';

    try {
      const content = this.txtContent.value;
      const res = await API.saveFile(this.currentPath, content);
      if (res.success) {
        if (this.statusBadge) this.statusBadge.textContent = 'Guardado (Copia .bak creada)';
        if (window.App && window.App.showToast) {
          window.App.showToast('Archivo guardado correctamente.', 'success');
        }
      }
    } catch (err) {
      if (this.statusBadge) this.statusBadge.textContent = 'Error al guardar';
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error al guardar archivo: ${err.message}`, 'error');
      }
    }
  }
}
