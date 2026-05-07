// src/utils/api.js
// API utility functions for reservation management - connects to seat_table_mngmnt database

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// Fetch all reservations from database
export async function fetchReservations(page = 1, perPage = 10, status = 'ALL', search = '') {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      ...(status !== 'ALL' && { status }),
      ...(search && { search })
    });
    
    const response = await fetch(`${API_BASE_URL}/admin/reservations?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[API] Failed to fetch reservations:', error);
    // Fallback to localStorage if API fails
    try {
      const stored = localStorage.getItem('bellevue_reservations');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

// Approve a reservation in database
export async function approveReservation(reservationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update localStorage as backup
    const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
    const updatedReservations = reservations.map(r => 
      r.id === reservationId ? { ...r, status: 'approved', reservation_state: 'active' } : r
    );
    localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
    
    return result;
  } catch (error) {
    console.error('[API] Failed to approve reservation:', error);
    // Fallback to localStorage if API fails
    try {
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      const updatedReservations = reservations.map(r => 
        r.id === reservationId ? { ...r, status: 'approved', reservation_state: 'active' } : r
      );
      localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
      return { success: true, message: 'Reservation approved successfully' };
    } catch {
      return { success: false, message: 'Failed to approve reservation' };
    }
  }
}

// Reject a reservation in database
export async function rejectReservation(reservationId, reason = '') {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update localStorage as backup
    const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
    const updatedReservations = reservations.map(r => 
      r.id === reservationId ? { ...r, status: 'rejected', reservation_state: 'inactive' } : r
    );
    localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
    
    return result;
  } catch (error) {
    console.error('[API] Failed to reject reservation:', error);
    // Fallback to localStorage if API fails
    try {
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      const updatedReservations = reservations.map(r => 
        r.id === reservationId ? { ...r, status: 'rejected', reservation_state: 'inactive' } : r
      );
      localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
      return { success: true, message: 'Reservation rejected successfully' };
    } catch {
      return { success: false, message: 'Failed to reject reservation' };
    }
  }
}

// Revert a rejected reservation back to pending review
export async function revertReservation(reservationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}/revert`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const now = new Date().toISOString();

    // Update localStorage as backup
    const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
    const updatedReservations = reservations.map(r =>
      r.id === reservationId
        ? { ...r, status: 'pending', reservation_state: 'active', previous_status: 'rejected', reverted_at: now, status_last_changed_at: now }
        : r
    );
    localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));

    return result;
  } catch (error) {
    console.error('[API] Failed to revert reservation:', error);
    // Fallback to localStorage if API fails
    try {
      const now = new Date().toISOString();
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      const updatedReservations = reservations.map(r =>
        r.id === reservationId
          ? { ...r, status: 'pending', reservation_state: 'active', previous_status: 'rejected', reverted_at: now, status_last_changed_at: now }
          : r
      );
      localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
      return { success: true, message: 'Reservation reverted to pending successfully' };
    } catch {
      return { success: false, message: 'Failed to revert reservation' };
    }
  }
}

// Create a new reservation in database
export async function createReservation(reservationData) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[API] Failed to create reservation:', error);
    // Fallback to localStorage if API fails
    try {
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      const newReservation = {
        ...reservationData,
        id: Date.now().toString(),
        status: 'pending',
        reservation_state: 'active',
        created_at: new Date().toISOString()
      };
      reservations.push(newReservation);
      localStorage.setItem('bellevue_reservations', JSON.stringify(reservations));
      return { success: true, data: newReservation };
    } catch {
      return { success: false, message: 'Failed to create reservation' };
    }
  }
}

// Update a reservation in database
export async function updateReservation(reservationId, reservationData) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update localStorage as backup
    const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
    const updatedReservations = reservations.map(r => 
      r.id === reservationId ? { ...r, ...reservationData } : r
    );
    localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
    
    return result;
  } catch (error) {
    console.error('[API] Failed to update reservation:', error);
    // Fallback to localStorage if API fails
    try {
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      const updatedReservations = reservations.map(r => 
        r.id === reservationId ? { ...r, ...reservationData } : r
      );
      localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
      return { success: true, data: updatedReservations.find(r => r.id === reservationId) };
    } catch {
      return { success: false, message: 'Failed to update reservation' };
    }
  }
}

// Delete a reservation from database
export async function deleteReservation(reservationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update localStorage as backup
    const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
    const updatedReservations = reservations.filter(r => r.id !== reservationId);
    localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
    
    return result;
  } catch (error) {
    console.error('[API] Failed to delete reservation:', error);
    // Fallback to localStorage if API fails
    try {
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      const updatedReservations = reservations.filter(r => r.id !== reservationId);
      localStorage.setItem('bellevue_reservations', JSON.stringify(updatedReservations));
      return { success: true, message: 'Reservation deleted successfully' };
    } catch {
      return { success: false, message: 'Failed to delete reservation' };
    }
  }
}

// Get reservation statistics from database
export async function getReservationStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reservations/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[API] Failed to get stats:', error);
    // Fallback to localStorage if API fails
    try {
      const reservations = JSON.parse(localStorage.getItem('bellevue_reservations') || '[]');
      return {
        total: reservations.length,
        pending: reservations.filter(r => r.status === 'pending').length,
        approved: reservations.filter(r => r.status === 'approved').length,
        rejected: reservations.filter(r => r.status === 'rejected').length,
        active: reservations.filter(r => (r.reservation_state || (['rejected', 'cancelled'].includes(r.status) ? 'inactive' : 'active')) === 'active').length,
        inactive: reservations.filter(r => (r.reservation_state || (['rejected', 'cancelled'].includes(r.status) ? 'inactive' : 'active')) === 'inactive').length
      };
    } catch {
      return { total: 0, pending: 0, approved: 0, rejected: 0, active: 0, inactive: 0 };
    }
  }
}
