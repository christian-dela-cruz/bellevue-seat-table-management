import api from "./api.js";

export const roleAPI = {
  getAll: () => api.get("/admin/roles"),
  
  getPermissions: () => api.get("/admin/roles/permissions"),
  
  create: (data) => api.post("/admin/roles", data),
  
  update: (id, data) => api.put(`/admin/roles/${id}`, data),
  
  delete: (id) => api.delete(`/admin/roles/${id}`)
};
