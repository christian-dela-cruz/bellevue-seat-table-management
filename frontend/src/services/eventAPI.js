const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export const eventAPI = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/admin/events`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to fetch events");
    }
    return res.json();
  },

  getPublic: async () => {
    const res = await fetch(`${API_BASE_URL}/events`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to fetch events");
    }
    return res.json();
  },

  getPublicBySlug: async (slug) => {
    const res = await fetch(`${API_BASE_URL}/events/${slug}`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to fetch event details");
    }
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE_URL}/admin/events`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create event");
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/admin/events/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to update event");
    }
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE_URL}/admin/events/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to delete event");
    }
    return res.json();
  },
};
