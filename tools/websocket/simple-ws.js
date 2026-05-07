const WebSocket = require('ws');
const http = require('http');
const wss = new WebSocket.Server({ port: 6003 });

console.log('WebSocket server starting on port 6003...');

// Store all connected clients
const clients = new Set();

// Create HTTP server for broadcast requests
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Received broadcast request:', data);
        
        // Broadcast to all WebSocket clients
        const message = JSON.stringify(data);
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(message);
            } catch (error) {
              console.error('Error sending to client:', error);
              clients.delete(client);
            }
          }
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clients: clients.size }));
      } catch (error) {
        console.error('Error processing broadcast:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Mount WebSocket server on HTTP server
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket server');
  clients.add(ws);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    event: 'connected',
    message: 'WebSocket server is live',
    clients: clients.size
  }));
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Start the server
server.listen(6003, () => {
  console.log('HTTP + WebSocket server running on port 6003');
  console.log('WebSocket endpoint: ws://localhost:6003');
  console.log('Broadcast endpoint: http://localhost:6003/broadcast');
});

// Function to broadcast events to all connected clients
function broadcast(event, data) {
  const message = JSON.stringify({
    event: event,
    payload: data,
    timestamp: new Date().toISOString()
  });
  
  console.log(`Broadcasting ${event} to ${clients.size} clients:`, data);
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending to client:', error);
        clients.delete(client);
      }
    }
  });
}

// Make broadcast function globally available
global.broadcastWebSocket = broadcast;

console.log('Ready to broadcast events to connected clients');

// Test broadcast every 30 seconds for testing
setInterval(() => {
  broadcast('test', { message: 'WebSocket server is alive', time: new Date().toISOString() });
}, 30000);
