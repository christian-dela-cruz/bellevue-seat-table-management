import api from "./api.js";

export const reportAPI = {
  getOutletReports: (params = {}) => api.get("/admin/reports/outlets", params),
  getTransactionReports: (params = {}) => api.get("/admin/reports/transactions", params),
  getMonthlyReports: (params = {}) => api.get("/admin/reports/monthly", params),
};
