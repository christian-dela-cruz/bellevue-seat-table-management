#!/usr/bin/env node

// Test script to create a reservation via API and trigger WebSocket events
const axios = require('axios');

async function testReservationAPI() {
  try {
    console.log('Creating test reservation...');
    
    const reservationData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      venue_id: 1,
      table_number: 'T1',
      seat_number: '1',
      guests_count: 2,
      event_date: '2024-12-25',
      event_time: '19:00',
      special_requests: 'Test reservation',
      type: 'individual'
    };
    
    const response = await axios.post('http://localhost:8000/api/reservations', reservationData);
    
    console.log('Reservation created successfully:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Wait a moment for WebSocket to process
    setTimeout(async () => {
      try {
        // Check broadcasts
        const broadcastResponse = await axios.get('http://localhost:8000/broadcasts');
        console.log('\nRecent broadcasts:');
        console.log(JSON.stringify(broadcastResponse.data, null, 2));
      } catch (error) {
        console.error('Error checking broadcasts:', error.message);
      }
    }, 3000);
    
  } catch (error) {
    console.error('Error creating reservation:', error.response?.data || error.message);
  }
}

testReservationAPI();
