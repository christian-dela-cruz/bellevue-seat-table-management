#!/usr/bin/env node

// Simple WebSocket server for development
const WebSocket = require('ws');
const http = require('http');
const axios = require('axios');
const url = require('url');

// Create HTTP server for WebSocket upgrade and broadcast endpoint
const server = http.createServer((req, res) => {
  // Handle broadcast endpoint
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(`[Broadcast] Received event: ${data.event}`);
        
        // Forward to all connected WebSocket clients
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              event: data.event,
              channel: data.channel || 'reservations',
              payload: data.payload
            }));
          }
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('[Broadcast] Error parsing message:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    // Handle broadcasts endpoint for polling
    if (req.url === '/broadcasts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ broadcasts: [] })); // Return empty for now
    } else {
      res.writeHead(404);
      res.end();
    }
  }
});

const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Store last processed broadcast timestamp
let lastBroadcastTime = null;

// Poll backend for broadcasts
async function pollBroadcasts() {
  try {
    const response = await axios.get('http://localhost:8000/broadcasts');
    const broadcasts = response.data.broadcasts || [];
    
    // Process new broadcasts
    broadcasts.forEach(broadcast => {
      const broadcastTime = new Date(broadcast.timestamp);
      
      // Only process if it's newer than our last processed time
      if (!lastBroadcastTime || broadcastTime > lastBroadcastTime) {
        console.log(`[Broadcast] Forwarding event: ${broadcast.event} on ${broadcast.channel}`);
        
        // Forward to all connected clients
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
