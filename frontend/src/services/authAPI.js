import api from './api.js';

export const authAPI = {
  // Login
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      
      if (response.success && response.token) {
        // Store token and user data
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin_user', JSON.stringify(response.admin));
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
  },

  // Get current user
  getCurrentUser: () => {
    const user = localStorage.getItem('admin_user');
    if (!user) return null;

    try {
      return JSON.parse(user);
    } catch (error) {
      console.warn('Invalid stored admin user. Clearing session user data.', error);
      localStorage.removeItem('admin_user');
      return null;
    }
  },

  // Get token
  getToken: () => {
    return localStorage.getItem('admin_token');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('admin_token');
  },

  hasPermission: (permission) => {
    const user = authAPI.getCurrentUser();
    const role = String(user?.role || '').toLowerCase();
    const rolePermissions = {
      super_admin: ['view_admin', 'manage_reservations', 'adjust_reservation_details', 'delete_reservations', 'acknowledge_notifications', 'manage_seat_maps', 'manage_venues', 'manage_events', 'view_outlet_reports', 'view_global_reports', 'view_transactions', 'manage_accounts', 'manage_users'],
      admin: ['view_admin', 'manage_reservations', 'adjust_reservation_details', 'delete_reservations', 'acknowledge_notifications', 'manage_seat_maps', 'manage_venues', 'manage_events', 'view_outlet_reports', 'view_transactions', 'manage_accounts'],
      fb_director: ['view_admin', 'view_outlet_reports', 'view_global_reports', 'view_transactions'],
      outlet_manager: ['view_admin', 'manage_reservations', 'adjust_reservation_details', 'acknowledge_notifications', 'view_outlet_reports', 'view_transactions'],
      supervisor: ['view_admin', 'manage_reservations', 'adjust_reservation_details', 'acknowledge_notifications', 'view_outlet_reports', 'view_transactions'],
      manager: ['view_admin', 'manage_reservations', 'adjust_reservation_details', 'acknowledge_notifications', 'view_outlet_reports', 'view_transactions'],
      staff: ['view_admin', 'acknowledge_notifications'],
      viewer: ['view_admin'],
      view_only: ['view_admin'],
    };

    const permissions = Array.isArray(user?.permissions) ? user.permissions : rolePermissions[role];

    return (permissions || []).includes(permission);
  },

  getAccounts: () => api.get('/admin/accounts'),

  createAccount: (accountData) => api.post('/admin/accounts', accountData),

  updateAccount: (id, accountData) => api.put(`/admin/accounts/${id}`, accountData),

  deactivateAccount: (id) => api.patch(`/admin/accounts/${id}/deactivate`),

  reactivateAccount: (id) => api.patch(`/admin/accounts/${id}/reactivate`),

  getActivationDetails: (token) => api.get(`/auth/activate/${token}`),

  activateAccount: (token, passwordData) => api.post(`/auth/activate/${token}`, passwordData),

  requestPasswordReset: (email) => api.post('/auth/forgot-password', { email }),

  updateProfile: async (profileData) => {
    const response = await api.put('/admin/accounts/me', profileData);

    if (response.success && response.admin) {
      localStorage.setItem('admin_user', JSON.stringify(response.admin));
    }

    return response;
  },

  // Verify 2FA code during login
  verify2FALogin: async (tempToken, code) => {
    try {
      const response = await api.post('/auth/2fa/verify', { temp_token: tempToken, code });
      if (response.success && response.token) {
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin_user', JSON.stringify(response.admin));
      }
      return response;
    } catch (error) {
      console.error('2FA verification login error:', error);
      throw error;
    }
  },

  // Password verification
  verifyPassword: (password) => api.post('/admin/accounts/verify-password', { password }),

  // Request email change
  requestEmailChange: (new_email, password) => api.post('/admin/accounts/request-email-change', { new_email, password }),

  // Confirm email change
  confirmEmailChange: (code) => api.post('/admin/accounts/confirm-email-change', { code }),

  // 2FA Setup
  setup2FA: () => api.post('/admin/accounts/2fa/setup'),

  // Enable 2FA
  enable2FA: (secret, code) => api.post('/admin/accounts/2fa/enable', { secret, code }),

  // Disable 2FA
  disable2FA: (password) => api.post('/admin/accounts/2fa/disable', { password }),

  // Get audit logs
  getAuditLogs: () => api.get('/admin/accounts/me/audit-logs'),

  // Get active sessions
  getActiveSessions: () => api.get('/admin/accounts/me/sessions'),

  // Revoke session
  revokeSession: (id) => api.delete(`/admin/accounts/me/sessions/${id}`),

  // Clear auth data
  clearAuth: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },
};
