import api from './api.js';

export const venueAPI = {
  // Get all venues
  getAll: (params = {}) => api.get('/venues', params),

  getTimeSlots: (params = {}) => api.get('/venues/time-slots', params),

  // Get single venue with seats and reservations
  getById: (id) => api.get(`/venues/${id}`),

  // Create new venue
  create: (venueData) => api.post('/venues', venueData),

  // Update venue
  update: (id, venueData) => api.put(`/venues/${id}`, venueData),

  uploadImage: (id, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.postForm(`/venues/${id}/image`, formData);
  },

  // Delete venue
  delete: (id) => api.delete(`/venues/${id}`),

  // Get venue seats
  getSeats: (venueId) => api.get(`/venues/${venueId}/seats`),

  // Get venue reservations
  getReservations: (venueId) => api.get(`/venues/${venueId}/reservations`),
};
