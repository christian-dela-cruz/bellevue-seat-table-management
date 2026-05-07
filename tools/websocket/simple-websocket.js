#!/usr/bin/env node

console.log('Starting WebSocket server...');

const WebSocket = require('ws');
const http = require('http');

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ port: 6001 });

// Store connected clients
const clients = new Set();

// Store last processed broadcast timestamp
let lastBroadcastTime = null;

// Poll backend for broadcasts
async function pollBroadcasts() {
  try {
    // Try to get real broadcasts from backend
    const axios = require('axios');
    const response = await axios.get('http://localhost:8000/broadcasts', { timeout: 2000 });
    const broadcasts = response.data.broadcasts || [];
    
    // Process new broadcasts
    broadcasts.forEach(broadcast => {
      const broadcastTime = new Date(broadcast.timestamp);
      
      if (!lastBroadcastTime || broadcastTime > lastBroadcastTime) {
        console.log(`[Broadcast] Forwarding event: ${broadcast.event} on ${broadcast.channel}`);
        
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              event: broadcast.event,
              channel: broadcast.channel,
              payload: broadcast.payload
            }));
          }
        });
        
        lastBroadcastTime = broadcastTime;
      }
    });
  } catch (error) {
    console.error('[Broadcast] Error polling backend:', error.message);
  }
}

// Start polling interval (every 2 seconds)
setInterval(pollBroadcasts, 2000);

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  clients.add(ws);
  
  // Send initial connection message
  ws.send(JSON.stringify({
    event: 'connected',
    data: { message: 'Connected to WebSocket server' }
  }));
  
  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Broadcast to all other clients
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            event: data.event || 'message',
            data: data.data || data
          }));
        }
      });
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Start server
const PORT = process.env.WS_PORT || 6001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
  console.log(`Backend polling: http://localhost:8000/broadcasts`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  server.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
