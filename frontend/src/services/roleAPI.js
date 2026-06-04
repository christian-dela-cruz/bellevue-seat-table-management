import { fetchAPI } from "./apiConfig";

export const roleAPI = {
  getAll: () => fetchAPI("/admin/roles"),
  
  getPermissions: () => fetchAPI("/admin/roles/permissions"),
  
  create: (data) => fetchAPI("/admin/roles", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  
  update: (id, data) => fetchAPI(`/admin/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }),
  
  delete: (id) => fetchAPI(`/admin/roles/${id}`, {
    method: "DELETE"
  })
};
