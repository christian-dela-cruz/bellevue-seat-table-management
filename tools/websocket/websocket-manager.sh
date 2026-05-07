#!/bin/bash

# WebSocket Server Management Script
# Usage: ./websocket-manager.sh [start|stop|restart|status|logs]

case "$1" in
    start)
        echo "🚀 Starting WebSocket server..."
        cd /Users/sarahabane/ojt/seat-table-mngmnt
        pkill -f "node websocket-server.js" 2>/dev/null
        nohup node websocket-server.js > websocket.log 2>&1 &
        sleep 2
        if pgrep -f "node websocket-server.js" > /dev/null; then
            echo "✅ WebSocket server started successfully!"
            echo "📊 Process ID: $(pgrep -f 'node websocket-server.js')"
            echo "📋 Logs: tail -f websocket.log"
        else
            echo "❌ Failed to start WebSocket server"
            exit 1
        fi
        ;;
    
    stop)
        echo "🛑 Stopping WebSocket server..."
        pkill -f "node websocket-server.js"
        if ! pgrep -f "node websocket-server.js" > /dev/null; then
            echo "✅ WebSocket server stopped successfully!"
        else
            echo "❌ Failed to stop WebSocket server"
            exit 1
        fi
        ;;
    
    restart)
        echo "🔄 Restarting WebSocket server..."
        $0 stop
        sleep 2
        $0 start
        ;;
    
    status)
        if pgrep -f "node websocket-server.js" > /dev/null; then
            echo "✅ WebSocket server is RUNNING"
            echo "📊 Process ID: $(pgrep -f 'node websocket-server.js')"
            echo "🌐 Port: 6001"
            echo "📋 Uptime: $(ps -o etime= -p $(pgrep -f 'node websocket-server.js') | tr -d ' ')"
        else
            echo "❌ WebSocket server is STOPPED"
        fi
        ;;
    
    logs)
        echo "📋 Showing WebSocket server logs (Ctrl+C to exit):"
        tail -f /Users/sarahabane/ojt/seat-table-mngmnt/websocket.log
        ;;
    
    install)
        echo "📦 Installing WebSocket server as macOS service..."
        cp /Users/sarahabane/ojt/seat-table-mngmnt/com.seatmanagement.websocket.plist ~/Library/LaunchAgents/
        launchctl load ~/Library/LaunchAgents/com.seatmanagement.websocket.plist
        echo "✅ WebSocket server installed as macOS service!"
        echo "🔄 It will automatically start on boot and restart if it crashes"
        ;;
    
    uninstall)
        echo "🗑️  Removing WebSocket server from macOS services..."
        launchctl unload ~/Library/LaunchAgents/com.seatmanagement.websocket.plist 2>/dev/null
        rm -f ~/Library/LaunchAgents/com.seatmanagement.websocket.plist
        $0 stop
        echo "✅ WebSocket server uninstalled from macOS services!"
        ;;
    
    *)
        echo "🎯 WebSocket Server Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|install|uninstall}"
        echo ""
        echo "Commands:"
        echo "  start     - Start WebSocket server"
        echo "  stop      - Stop WebSocket server"
        echo "  restart   - Restart WebSocket server"
        echo "  status    - Show server status"
        echo "  logs      - Show live logs"
        echo "  install   - Install as macOS service (auto-start on boot)"
        echo "  uninstall - Remove from macOS services"
        echo ""
        echo "🌐 WebSocket server runs on port 6001"
        echo "📋 Log file: websocket.log"
        exit 1
        ;;
esac
