#!/bin/bash

# WebSocket Server Startup Script
# This script keeps the WebSocket server running continuously

cd /Users/sarahabane/ojt/seat-table-mngmnt

# Kill any existing WebSocket server processes
pkill -f "node websocket-server.js" 2>/dev/null

# Start WebSocket server in background with logging
nohup node websocket-server.js > websocket.log 2>&1 &

echo "WebSocket server started in background"
echo "Process ID: $!"
echo "Log file: /Users/sarahabane/ojt/seat-table-mngmnt/websocket.log"
echo ""
echo "To stop: pkill -f 'node websocket-server.js'"
echo "To check logs: tail -f websocket.log"
