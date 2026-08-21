/**
 * Authentication and RBAC Manager for Frontend Client
 */
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.listeners = [];
  }

  async init() {
    try {
      const res = await API.authMe();
      if (res && res.success && res.user) {
        this.setUser(res.user);
        return true;
      }
    } catch (e) {
      // Not authenticated or session expired
    }
    this.setUser(null);
    return false;
  }

  setUser(user) {
    this.currentUser = user;
    this.isAuthenticated = !!user;
    this.applyPermissionsToUI();
    this.notifyListeners();
  }

  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentUser, this.isAuthenticated);
      } catch (err) {
        console.error('[AuthManager] Error in auth listener:', err);
      }
    }
  }

  hasPermission(requiredPermission) {
    if (!this.currentUser || !Array.isArray(this.currentUser.permissions)) {
      return false;
    }

    const perms = this.currentUser.permissions;

    // 1. Global wildcard
    if (perms.includes('*')) return true;

    // 2. Exact match
    if (perms.includes(requiredPermission)) return true;

    // 3. Category wildcard match (e.g. 'mods.*' matches 'mods.manage')
    const parts = requiredPermission.split('.');
    if (parts.length > 1) {
      const wildcard = `${parts[0]}.*`;
      if (perms.includes(wildcard)) return true;
    }

    return false;
  }

  hasRole(requiredRole) {
    if (!this.currentUser || !Array.isArray(this.currentUser.roles)) {
      return false;
    }
    return this.currentUser.roles.includes(requiredRole) || this.currentUser.roles.includes('admin');
  }

  applyPermissionsToUI() {
    // 1. Process data-permission attributes
    const permElements = document.querySelectorAll('[data-permission]');
    permElements.forEach(el => {
      const requiredPerm = el.dataset.permission;
      const allowed = this.hasPermission(requiredPerm);

      if (el.dataset.rbacAction === 'disable') {
        el.disabled = !allowed;
        el.classList.toggle('rbac-disabled', !allowed);
      } else {
        // default is hide
        el.classList.toggle('rbac-hidden', !allowed);
      }
    });

    // 2. Process data-role attributes
    const roleElements = document.querySelectorAll('[data-role]');
    roleElements.forEach(el => {
      const requiredRole = el.dataset.role;
      const allowed = this.hasRole(requiredRole);
      el.classList.toggle('rbac-hidden', !allowed);
    });

    // 3. Update User Header Widget
    const userWidget = document.getElementById('user-header-widget');
    const guestWidget = document.getElementById('guest-header-widget');
    const usernameEl = document.getElementById('header-username');
    const userRoleEl = document.getElementById('header-user-role');
    const userAvatarEl = document.getElementById('header-user-avatar');

    if (this.isAuthenticated && this.currentUser) {
      if (userWidget) userWidget.classList.remove('hidden');
      if (guestWidget) guestWidget.classList.add('hidden');

      if (usernameEl) usernameEl.textContent = this.currentUser.username;
      
      const primaryRole = (this.currentUser.roles && this.currentUser.roles[0]) || 'viewer';
      if (userRoleEl) {
        userRoleEl.textContent = primaryRole.toUpperCase();
        userRoleEl.className = `user-role-badge role-${primaryRole.toLowerCase()}`;
      }

      if (userAvatarEl) {
        userAvatarEl.textContent = (this.currentUser.username || 'U').charAt(0).toUpperCase();
      }
    } else {
      if (userWidget) userWidget.classList.add('hidden');
      if (guestWidget) guestWidget.classList.remove('hidden');
    }
  }

  async login(username, password) {
    const res = await API.authLogin(username, password);
    if (res.success && res.user) {
      this.setUser(res.user);
      return res;
    }
    throw new Error(res.error || 'Error al iniciar sesión');
  }

  async register(username, email, password) {
    const res = await API.authRegister(username, email, password);
    if (res.success && res.user) {
      this.setUser(res.user);
      return res;
    }
    throw new Error(res.error || 'Error al registrarse');
  }

  async logout() {
    try {
      await API.authLogout();
    } catch (e) {
      // ignore
    }
    this.setUser(null);
    window.location.reload();
  }

  showLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
    }
  }

  hideLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.classList.add('hidden');
    }
  }
}

const authManager = new AuthManager();
