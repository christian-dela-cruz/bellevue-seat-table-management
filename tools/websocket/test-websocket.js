#!/usr/bin/env node

// Test script to simulate WebSocket events
const WebSocket = require('ws');

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:6001');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Simulate a reservation created event
  setTimeout(() => {
    const event = {
      event: 'ReservationCreated',
      channel: 'reservations',
      payload: {
        reservation: {
          id: 123,
          guest_name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          table_number: 'T1',
          seat_number: '1',
          guests_count: 2,
          event_date: '2024-12-25',
          event_time: '19:00',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      }
    };
    
    console.log('Sending ReservationCreated event:', JSON.stringify(event, null, 2));
    ws.send(JSON.stringify(event));
  }, 1000);
  
  // Simulate a reservation updated event (approved)
  setTimeout(() => {
    const event = {
      event: 'ReservationUpdated',
      channel: 'reservations',
      payload: {
        reservation: {
          id: 123,
          guest_name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          table_number: 'T1',
          seat_number: '1',
          guests_count: 2,
          event_date: '2024-12-25',
          event_time: '19:00',
          status: 'approved',
          updated_at: new Date().toISOString()
        }
      }
    };
    
    console.log('Sending ReservationUpdated event:', JSON.stringify(event, null, 2));
    ws.send(JSON.stringify(event));
  }, 3000);
  
  // Close connection after sending events
  setTimeout(() => {
    ws.close();
  }, 5000);
});

ws.on('message', (message) => {
  console.log('Received message:', message.toString());
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
