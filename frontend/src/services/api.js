const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000/api' : `${window.location.protocol}//${window.location.host}/api`);

class ApiService {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('admin_token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData = {};
        try {
          const text = await response.text();
          console.log(`[API] Error response (${response.status}):`, text);
          try {
            errorData = JSON.parse(text);
          } catch {
            errorData = { message: text || `HTTP ${response.status}` };
          }
        } catch {
          errorData = { message: `HTTP ${response.status}` };
        }

        const error = new Error(
          errorData.message ||
          errorData.error ||
          `HTTP error! status: ${response.status}`
        );
        error.status = response.status;
        error.data = errorData;
        error.response = { status: response.status, data: errorData };
        throw error;
      }

      // Handle empty body (204 No Content, or some PATCH/DELETE responses)
      if (response.status === 204) return {};
      const text = await response.text();
      if (!text || !text.trim()) return {};

      try {
        return JSON.parse(text);
      } catch {
        console.warn('[API] Response was not JSON:', text);
        return { raw: text };
      }

    } catch (error) {
      // Re-throw errors we already processed above
      if (error.status) throw error;
      // Network-level errors (no connection, CORS, etc.)
      console.error('[API] Network error:', error);
      const networkError = new Error('Network error — could not reach the server.');
      networkError.status = 0;
      networkError.data = {};
      networkError.response = { status: 0, data: {} };
      throw networkError;
    }
  }

  get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url);
  }

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async postForm(endpoint, formData) {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP error! status: ${response.status}` };
      }
      const error = new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    if (response.status === 204) return {};
    return response.json();
  }

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

export default new ApiService();
