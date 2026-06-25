// src/utils/reservationCleanup.js
// Utility for cleaning up reservations when tables/seats are deleted

// Deletion logging functionality removed
import { deleteReservation } from './api.js';

// Clean up reservations when a table is deleted
export async function cleanupReservationsForDeletedTable(tableData, wing, room, deletedBy = 'system') {
  try {
    console.log(`[ReservationCleanup] Cleaning up reservations for deleted table:`, tableData);
    
    // Get current reservations
    const reservations = await getCurrentReservations();
    
    // Find affected reservations (simplified without DELETION_TYPES)
    const affectedReservations = findAffectedReservationsForTable(tableData, reservations);
    
    console.log(`[ReservationCleanup] Found ${affectedReservations.length} affected reservations`);
    
    // Delete affected reservations
    const deletionResults = [];
    for (const affected of affectedReservations) {
      try {
        const result = await deleteReservation(affected.reservation.db_id || affected.reservation.id);
        
        deletionResults.push({
          success: true,
          reservation: affected.reservation,
          reason: affected.reason,
          result
        });
      } catch (error) {
        console.error(`[ReservationCleanup] Failed to delete reservation ${affected.reservation.id}:`, error);
        deletionResults.push({
          success: false,
          reservation: affected.reservation,
          reason: affected.reason,
          error: error.message
        });
      }
    }
    
    return {
      deletedTable: tableData,
      affectedCount: affectedReservations.length,
      deletionResults
    };
  } catch (error) {
    console.error('[ReservationCleanup] Error cleaning up reservations for deleted table:', error);
    throw error;
  }
}

// Clean up reservations when a seat is deleted
export async function cleanupReservationsForDeletedSeat(seatData, tableData, wing, room, deletedBy = 'system') {
  try {
    console.log(`[ReservationCleanup] Cleaning up reservations for deleted seat:`, seatData);
    
    // Log the seat deletion
    const deletionLog = logDeletion(DELETION_TYPES.SEAT, seatData, wing, room, deletedBy);
    
    // Get current reservations
    const reservations = await getCurrentReservations();
    
    // Find affected reservations
    const affectedReservations = findAffectedReservations(
      { type: DELETION_TYPES.SEAT, itemData: seatData },
      reservations
    );
    
    console.log(`[ReservationCleanup] Found ${affectedReservations.length} affected reservations`);
    
    // Delete affected reservations
    const deletionResults = [];
    for (const affected of affectedReservations) {
      try {
        const result = await deleteReservation(affected.reservation.db_id || affected.reservation.id);
        
        // Log the reservation deletion
        logDeletion(
          DELETION_TYPES.RESERVATION,
          affected.reservation,
          wing,
          room,
          `system (seat deletion: ${seatData.label || seatData.num})`
        );
        
        deletionResults.push({
          success: true,
          reservation: affected.reservation,
          reason: affected.reason,
          result
        });
      } catch (error) {
        console.error(`[ReservationCleanup] Failed to delete reservation ${affected.reservation.id}:`, error);
        deletionResults.push({
          success: false,
          reservation: affected.reservation,
          reason: affected.reason,
          error: error.message
        });
      }
    }
    
    return {
      deletedSeat: seatData,
      tableData,
      affectedCount: affectedReservations.length,
      deletionResults,
      deletionLog
    };
  } catch (error) {
    console.error('[ReservationCleanup] Error cleaning up reservations for deleted seat:', error);
    throw error;
  }
}

// Clean up reservations when a standalone seat is deleted
export async function cleanupReservationsForDeletedStandaloneSeat(seatData, wing, room, deletedBy = 'system') {
  try {
    console.log(`[ReservationCleanup] Cleaning up reservations for deleted standalone seat:`, seatData);
    
    // Log the standalone seat deletion
    const deletionLog = logDeletion(DELETION_TYPES.STANDALONE_SEAT, seatData, wing, room, deletedBy);
    
    // Get current reservations
    const reservations = await getCurrentReservations();
    
    // Find affected reservations
    const affectedReservations = findAffectedReservations(
      { type: DELETION_TYPES.STANDALONE_SEAT, itemData: seatData },
      reservations
    );
    
    console.log(`[ReservationCleanup] Found ${affectedReservations.length} affected reservations`);
    
    // Delete affected reservations
    const deletionResults = [];
    for (const affected of affectedReservations) {
      try {
        const result = await deleteReservation(affected.reservation.db_id || affected.reservation.id);
        
        // Log the reservation deletion
        logDeletion(
          DELETION_TYPES.RESERVATION,
          affected.reservation,
          wing,
          room,
          `system (standalone seat deletion: ${seatData.label || seatData.num})`
        );
        
        deletionResults.push({
          success: true,
          reservation: affected.reservation,
          reason: affected.reason,
          result
        });
      } catch (error) {
        console.error(`[ReservationCleanup] Failed to delete reservation ${affected.reservation.id}:`, error);
        deletionResults.push({
          success: false,
          reservation: affected.reservation,
          reason: affected.reason,
          error: error.message
        });
      }
    }
    
    return {
      deletedStandaloneSeat: seatData,
      affectedCount: affectedReservations.length,
      deletionResults,
      deletionLog
    };
  } catch (error) {
    console.error('[ReservationCleanup] Error cleaning up reservations for deleted standalone seat:', error);
    throw error;
  }
}

// Get current reservations from API or localStorage
async function getCurrentReservations() {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:8000/api" : `${window.location.protocol}//${window.location.host}/api`);
    
    const token = localStorage.getItem("admin_token");
    const response = await fetch(`${API_BASE_URL}/admin/reservations?per_page=9999`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    }
  } catch (error) {
    console.error('[ReservationCleanup] Failed to fetch reservations from API, falling back to localStorage:', error);
  }
  
  // Fallback to localStorage
  try {
    const stored = localStorage.getItem('bellevue_reservations');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[ReservationCleanup] Failed to get reservations from localStorage:', error);
    return [];
  }
}

// Batch cleanup for multiple deleted items
export async function batchCleanupDeletedItems(deletedItems, wing, room, deletedBy = 'system') {
  try {
    console.log(`[ReservationCleanup] Starting batch cleanup for ${deletedItems.length} deleted items`);
    
    const results = [];
    
    for (const item of deletedItems) {
      let result;
      
      if (item.type === DELETION_TYPES.TABLE) {
        result = await cleanupReservationsForDeletedTable(item.data, wing, room, deletedBy);
      } else if (item.type === DELETION_TYPES.SEAT) {
        result = await cleanupReservationsForDeletedSeat(item.data, item.tableData, wing, room, deletedBy);
      } else if (item.type === DELETION_TYPES.STANDALONE_SEAT) {
        result = await cleanupReservationsForDeletedStandaloneSeat(item.data, wing, room, deletedBy);
      } else {
        console.warn(`[ReservationCleanup] Unknown deletion type: ${item.type}`);
        continue;
      }
      
      results.push(result);
    }
    
    const totalAffected = results.reduce((sum, result) => sum + result.affectedCount, 0);
    const totalSuccessful = results.reduce((sum, result) => 
      sum + result.deletionResults.filter(r => r.success).length, 0
    );
    
    console.log(`[ReservationCleanup] Batch cleanup completed. Total affected: ${totalAffected}, Successful deletions: ${totalSuccessful}`);
    
    return {
      totalItems: deletedItems.length,
      totalAffected,
      totalSuccessful,
      results
    };
  } catch (error) {
    console.error('[ReservationCleanup] Error in batch cleanup:', error);
    throw error;
  }
}
