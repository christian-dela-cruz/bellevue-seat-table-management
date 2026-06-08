import api from './api';

export const clientDisplayAPI = {
  getAll: async () => {
    const res = await api.get('/client-display');
    return res.data;
  },

  updateSection: async (section, data) => {
    const res = await api.put(`/client-display/${section}`, data);
    return res.data;
  }
};

export default clientDisplayAPI;
