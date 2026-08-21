/**
 * User & Role Management Controller
 */
class UserManagementController {
  constructor() {
    this.users = [];
    this.roles = [];
    this.permissions = [];
    this.editingUserId = null;

    this.init();
  }

  init() {
    this.initEvents();
  }

  initEvents() {
    const btnNewUser = document.getElementById('btn-new-user');
    if (btnNewUser) {
      btnNewUser.addEventListener('click', () => this.openUserModal());
    }

    const btnRefreshUsers = document.getElementById('btn-refresh-users');
    if (btnRefreshUsers) {
      btnRefreshUsers.addEventListener('click', () => this.loadAll());
    }

    const btnRefreshAudit = document.getElementById('btn-refresh-audit');
    if (btnRefreshAudit) {
      btnRefreshAudit.addEventListener('click', () => this.loadAuditLogs());
    }

    const formUser = document.getElementById('form-user-edit');
    if (formUser) {
      formUser.addEventListener('submit', (e) => this.handleSaveUser(e));
    }

    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    if (btnCloseUserModal) {
      btnCloseUserModal.addEventListener('click', () => this.closeUserModal());
    }

    const btnCancelUserModal = document.getElementById('btn-cancel-user-modal');
    if (btnCancelUserModal) {
      btnCancelUserModal.addEventListener('click', () => this.closeUserModal());
    }

    // Subtabs within Users Tab (Users vs Audit Logs)
    const userSubTabs = document.querySelectorAll('.user-subtab-btn');
    userSubTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        userSubTabs.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.user-subtab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.dataset.subtab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');

        if (targetId === 'subtab-audit') {
          this.loadAuditLogs();
        } else {
          this.loadUsers();
        }
      });
    });
  }

  async loadAll() {
    await Promise.all([this.loadRoles(), this.loadUsers()]);
  }

  async loadRoles() {
    try {
      const res = await API.getRoles();
      if (res.success) {
        this.roles = res.roles || [];
      }
    } catch (err) {
      console.error('[UserManagement] Error loading roles:', err);
    }
  }

  async loadUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Cargando usuarios...</td></tr>';

    try {
      const res = await API.getUsers();
      if (res.success) {
        this.users = res.users || [];
        this.renderUsersTable();
      } else {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${res.error || 'Error al cargar usuarios'}</td></tr>`;
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${err.message}</td></tr>`;
    }
  }

  renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay usuarios registrados</td></tr>';
      return;
    }

    const currentUserId = authManager.currentUser ? authManager.currentUser.id : null;
    const canManage = authManager.hasPermission('users.manage');

    tbody.innerHTML = this.users.map(u => {
      const roleBadges = (u.roles || []).map(r => 
        `<span class="user-role-badge role-${r.toLowerCase()}">${r.toUpperCase()}</span>`
      ).join(' ');

      const statusBadge = u.is_active 
        ? '<span class="badge badge-emerald">Activo</span>' 
        : '<span class="badge badge-crimson">Inactivo</span>';

      const lastLogin = u.last_login_at 
        ? new Date(u.last_login_at).toLocaleString() 
        : '<span class="text-muted">Nunca</span>';

      const isSelf = currentUserId === u.id;

      return `
        <tr class="${!u.is_active ? 'row-inactive' : ''}">
          <td><strong>#${u.id}</strong></td>
          <td>
            <div class="user-cell-info">
              <span class="user-cell-name">${this.escapeHtml(u.username)}</span>
              ${isSelf ? '<span class="badge badge-outline-cyan">Tú</span>' : ''}
            </div>
          </td>
          <td>${this.escapeHtml(u.email)}</td>
          <td>${roleBadges}</td>
          <td>${statusBadge}</td>
          <td>${lastLogin}</td>
          <td>
            ${canManage ? `
              <div class="table-actions">
                <button class="btn btn-xs btn-outline-cyan btn-edit-user" data-id="${u.id}" title="Editar Usuario">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Editar
                </button>
                ${!isSelf ? `
                  <button class="btn btn-xs ${u.is_active ? 'btn-outline-amber' : 'btn-outline-emerald'} btn-toggle-user" data-id="${u.id}" data-active="${u.is_active}">
                    ${u.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button class="btn btn-xs btn-outline-crimson btn-delete-user" data-id="${u.id}" title="Eliminar Usuario">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                ` : ''}
              </div>
            ` : '<span class="text-muted text-xs">Solo lectura</span>'}
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        this.openUserModal(id);
      });
    });

    tbody.querySelectorAll('.btn-toggle-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        const isActive = btn.dataset.active === '1';
        try {
          await API.updateUser(id, { isActive: !isActive });
          if (window.App && window.App.showToast) {
            window.App.showToast(`Usuario ${!isActive ? 'activado' : 'desactivado'} exitosamente`, 'success');
          }
          this.loadUsers();
        } catch (e) {
          if (window.App && window.App.showToast) {
            window.App.showToast(`Error: ${e.message}`, 'error');
          }
        }
      });
    });

    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        if (!confirm('¿Estás seguro de que deseas eliminar este usuario de forma permanente?')) {
          return;
        }

        try {
          await API.deleteUser(id);
          if (window.App && window.App.showToast) {
            window.App.showToast('Usuario eliminado exitosamente', 'success');
          }
          this.loadUsers();
        } catch (e) {
          if (window.App && window.App.showToast) {
            window.App.showToast(`Error: ${e.message}`, 'error');
          }
        }
      });
    });
  }

  async loadAuditLogs() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Cargando registros de auditoría...</td></tr>';

    try {
      const res = await API.getAuditLogs(50);
      if (res.success) {
        const logs = res.logs || [];
        if (logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay registros de auditoría aún</td></tr>';
          return;
        }

        tbody.innerHTML = logs.map(l => {
          let detailsFormatted = '';
          if (l.details) {
            try {
              const parsed = JSON.parse(l.details);
              detailsFormatted = `<code class="audit-details-code">${JSON.stringify(parsed)}</code>`;
            } catch (e) {
              detailsFormatted = this.escapeHtml(l.details);
            }
          }

          return `
            <tr>
              <td><span class="text-muted">#${l.id}</span></td>
              <td><strong>${this.escapeHtml(l.username || 'Anónimo')}</strong></td>
              <td><span class="badge badge-outline-cyan">${this.escapeHtml(l.action)}</span></td>
              <td>${detailsFormatted || '-'}</td>
              <td><small class="text-muted">${new Date(l.created_at).toLocaleString()}</small></td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${err.message}</td></tr>`;
    }
  }

  openUserModal(userId = null) {
    this.editingUserId = userId;
    const modal = document.getElementById('modal-user-edit');
    const titleEl = document.getElementById('user-modal-title');
    const usernameInput = document.getElementById('input-user-username');
    const emailInput = document.getElementById('input-user-email');
    const passInput = document.getElementById('input-user-password');
    const passHelp = document.getElementById('user-password-help');
    const activeCheck = document.getElementById('input-user-active');
    const rolesContainer = document.getElementById('user-roles-checkboxes');

    if (!modal) return;

    // Render roles checkboxes
    if (rolesContainer) {
      rolesContainer.innerHTML = this.roles.map(r => `
        <label class="checkbox-label">
          <input type="checkbox" name="user-role" value="${r.name}" class="chk-user-role">
          <span><strong>${r.name.toUpperCase()}</strong> - <small class="text-muted">${this.escapeHtml(r.description || '')}</small></span>
        </label>
      `).join('');
    }

    if (userId) {
      const user = this.users.find(u => u.id === userId);
      if (!user) return;

      if (titleEl) titleEl.textContent = `Editar Usuario: ${user.username}`;
      if (usernameInput) {
        usernameInput.value = user.username;
        usernameInput.disabled = true; // Username cannot be changed
      }
      if (emailInput) emailInput.value = user.email;
      if (passInput) {
        passInput.value = '';
        passInput.required = false;
      }
      if (passHelp) passHelp.textContent = 'Deja en blanco para no cambiar la contraseña';
      if (activeCheck) activeCheck.checked = !!user.is_active;

      // Check user roles
      const userRoleNames = user.roles || [];
      document.querySelectorAll('.chk-user-role').forEach(chk => {
        chk.checked = userRoleNames.includes(chk.value);
      });
    } else {
      if (titleEl) titleEl.textContent = 'Crear Nuevo Usuario';
      if (usernameInput) {
        usernameInput.value = '';
        usernameInput.disabled = false;
      }
      if (emailInput) emailInput.value = '';
      if (passInput) {
        passInput.value = '';
        passInput.required = true;
      }
      if (passHelp) passHelp.textContent = 'Mínimo 6 caracteres';
      if (activeCheck) activeCheck.checked = true;

      // Default role: viewer
      document.querySelectorAll('.chk-user-role').forEach(chk => {
        chk.checked = chk.value === 'viewer';
      });
    }

    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  closeUserModal() {
    const modal = document.getElementById('modal-user-edit');
    if (modal) {
      modal.classList.remove('active');
      modal.classList.add('hidden');
    }
    this.editingUserId = null;
  }

  async handleSaveUser(e) {
    e.preventDefault();

    const email = document.getElementById('input-user-email')?.value.trim();
    const password = document.getElementById('input-user-password')?.value;
    const isActive = document.getElementById('input-user-active')?.checked;

    const selectedRoles = [];
    document.querySelectorAll('.chk-user-role:checked').forEach(chk => {
      selectedRoles.push(chk.value);
    });

    if (selectedRoles.length === 0) {
      if (window.App && window.App.showToast) {
        window.App.showToast('Debes seleccionar al menos un rol para el usuario', 'warn');
      }
      return;
    }

    try {
      if (this.editingUserId) {
        // Update
        const payload = {
          email,
          isActive,
          roles: selectedRoles
        };
        if (password && password.length >= 6) {
          payload.password = password;
        }

        const res = await API.updateUser(this.editingUserId, payload);
        if (res.success) {
          if (window.App && window.App.showToast) {
            window.App.showToast('Usuario actualizado con éxito', 'success');
          }
          this.closeUserModal();
          this.loadUsers();
        }
      } else {
        // Create
        const username = document.getElementById('input-user-username')?.value.trim();
        const res = await API.createUser({
          username,
          email,
          password,
          roles: selectedRoles,
          isActive
        });

        if (res.success) {
          if (window.App && window.App.showToast) {
            window.App.showToast('Usuario creado con éxito', 'success');
          }
          this.closeUserModal();
          this.loadUsers();
        }
      }
    } catch (err) {
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error: ${err.message}`, 'error');
      }
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
