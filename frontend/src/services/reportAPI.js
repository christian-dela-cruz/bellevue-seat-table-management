import api from "./api.js";

export const reportAPI = {
  getOutletReports: (params = {}) => api.get("/admin/reports/outlets", params),
};
