import api from './api.js';

export const reservationAPI = {
  // Get all admin reservations
  getAll: (queryParams = '') => api.get(`/admin/reservations${queryParams}`),

  // Get reservation statistics
  getStats: () => api.get('/admin/reservations/stats'),

  // Get single reservation
  getById: (id) => api.get(`/admin/reservations/${id}`),

  // Get seatmap data for a venue
  getSeatmap: (wing, room) => api.get(`/seatmap/${wing}/${room}`),

  // Create new reservation
  create: (reservationData) => api.post('/reservations', reservationData),

  // Update reservation
  update: (id, reservationData) => api.put(`/admin/reservations/${id}`, reservationData),

  // Delete reservation
  delete: (id) => api.delete(`/admin/reservations/${id}`),

  // Approve reservation
  approve: (id) => api.patch(`/admin/reservations/${id}/approve`),

  // Reject reservation
  reject: (id, reason) => api.patch(`/admin/reservations/${id}/reject`, { reason }),

  // Revert rejected reservation to pending
  revert: (id) => api.patch(`/admin/reservations/${id}/revert`),

  // Cancel reservation (admin)
  cancel: (id, reason) => api.patch(`/admin/reservations/${id}/cancel`, { reason }),

  // Update operational coordination metadata
  updateCoordination: (id, coordinationData) => api.patch(`/admin/reservations/${id}/coordination`, coordinationData),

  // Mark reservation detail as seen by the current operations user
  markSeen: (id) => api.post(`/admin/reservations/${id}/seen`),

  // Shared notification acknowledgment state
  getAcknowledgments: () => api.get('/admin/notifications/acknowledgments'),
  acknowledgeNotifications: (items = []) => api.post('/admin/notifications/acknowledgments', { items }),
};
