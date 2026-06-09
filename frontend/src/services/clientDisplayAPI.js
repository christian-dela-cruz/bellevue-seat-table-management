import api from './api';

export const clientDisplayAPI = {
  getAll: async () => {
    const res = await api.get('/client-display');
    return Array.isArray(res) ? res : (res?.data ?? res ?? []);
  },

  updateSection: async (section, data) => {
    return api.put(`/client-display/${section}`, data);
  }
};

export default clientDisplayAPI;
