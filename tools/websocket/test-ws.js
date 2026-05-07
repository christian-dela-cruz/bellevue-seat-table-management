const WebSocket = require('ws');
const http = require('http');

console.log('Starting WebSocket server on port 6004...');

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
        console.log('Received broadcast request:', data.event);
        
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

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    ws.send('Echo: ' + message);
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    event: 'connected',
    message: 'WebSocket server is working!',
    clients: clients.size
  }));
});

server.listen(6004, () => {
  console.log('HTTP + WebSocket server running on port 6004');
  console.log('WebSocket endpoint: ws://localhost:6004');
  console.log('Broadcast endpoint: http://localhost:6004/broadcast');
});

console.log('WebSocket server ready!');

// Test broadcast every 10 seconds
setInterval(() => {
  const message = {
    event: 'test',
    payload: {
      message: 'Server is alive!',
      time: new Date().toISOString()
    }
  };
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}, 10000);
