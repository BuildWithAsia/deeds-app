// ====== ADMIN CORE UTILITIES ======
// Shared utilities for all admin pages

// Toast Notification System
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toast-container');
    }
  }

  show(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    const id = `toast-${Date.now()}`;
    toast.id = id;

    const colors = {
      success: 'bg-teal-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-600 text-white',
      info: 'bg-purple-600 text-white'
    };

    const icons = {
      success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
      error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
      warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    toast.className = `${colors[type]} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0`;
    toast.innerHTML = `
      <div class="flex-shrink-0">${icons[type]}</div>
      <div class="flex-1 text-sm font-medium">${message}</div>
      <button onclick="toastManager.dismiss('${id}')" class="flex-shrink-0 hover:opacity-75 transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  dismiss(id) {
    const toast = document.getElementById(id);
    if (toast) {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }
}

// Initialize global toast manager
const toastManager = new ToastManager();
window.toastManager = toastManager;

// Loading State Helper
class LoadingManager {
  show(element, text = 'Loading...') {
    if (!element) return;

    element.classList.add('relative');
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10';
    overlay.setAttribute('data-loading-overlay', 'true');
    overlay.innerHTML = `
      <div class="flex flex-col items-center gap-2">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p class="text-sm text-slate-600">${text}</p>
      </div>
    `;
    element.appendChild(overlay);
  }

  hide(element) {
    if (!element) return;
    const overlay = element.querySelector('[data-loading-overlay]');
    if (overlay) {
      overlay.remove();
    }
  }
}

const loadingManager = new LoadingManager();
window.loadingManager = loadingManager;

// Confirmation Dialog
function confirmAction(message, onConfirm, onCancel) {
  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  dialog.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
      <h3 class="text-lg font-semibold text-slate-900 mb-2">Confirm Action</h3>
      <p class="text-slate-600 mb-6">${message}</p>
      <div class="flex gap-3 justify-end">
        <button data-action="cancel" class="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition">
          Cancel
        </button>
        <button data-action="confirm" class="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          Confirm
        </button>
      </div>
    </div>
  `;

  dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    dialog.remove();
    if (onCancel) onCancel();
  });

  dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    dialog.remove();
    if (onConfirm) onConfirm();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
      if (onCancel) onCancel();
    }
  });

  document.body.appendChild(dialog);
}

window.confirmAction = confirmAction;

// Format date helper
function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

window.formatDate = formatDate;

// Get admin session
function getAdminSession() {
  try {
    const profileData = localStorage.getItem('deeds.profile');
    if (!profileData) return null;

    const profile = JSON.parse(profileData);
    if (profile.role !== 'admin') {
      toastManager.error('Admin access required');
      setTimeout(() => window.location.href = '/login.html', 2000);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Failed to get admin session:', error);
    return null;
  }
}

window.getAdminSession = getAdminSession;

// API request helper with auth
async function adminFetch(url, options = {}) {
  const profile = getAdminSession();
  if (!profile) {
    throw new Error('No admin session');
  }

  const defaultOptions = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${profile.sessionToken || profile.token}`
    }
  };

  // Merge headers properly to avoid overwriting Authorization
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  return fetch(url, mergedOptions);
}

window.adminFetch = adminFetch;

// Keyboard shortcuts manager
class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      const handler = this.shortcuts.get(key);

      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  register(key, handler, description) {
    this.shortcuts.set(key.toLowerCase(), handler);
    console.log(`[Shortcut] Registered: ${key} - ${description}`);
  }

  showHelp() {
    const shortcuts = Array.from(this.shortcuts.entries());
    console.table(shortcuts.map(([key, _]) => ({ Key: key })));
  }
}

const keyboardShortcuts = new KeyboardShortcuts();
window.keyboardShortcuts = keyboardShortcuts;

// Auto-refresh utility
class AutoRefresh {
  constructor(callback, interval = 30000) {
    this.callback = callback;
    this.interval = interval;
    this.timerId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.timerId = setInterval(() => {
      console.log('[AutoRefresh] Refreshing data...');
      this.callback();
    }, this.interval);

    console.log(`[AutoRefresh] Started (every ${this.interval/1000}s)`);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      this.isRunning = false;
      console.log('[AutoRefresh] Stopped');
    }
  }

  restart() {
    this.stop();
    this.start();
  }
}

window.AutoRefresh = AutoRefresh;

console.log('[Admin Core] Utilities loaded successfully');
