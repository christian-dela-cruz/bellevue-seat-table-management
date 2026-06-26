// Custom WebSocket implementation for local development
class LocalWebSocket {
  constructor(options = {}) {
    this.options = options;
    this.channels = new Map();
    this.connected = false;
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = Infinity;
    this.retryDelay = 5000;
    
    this.connect();
  }
  
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_PUSHER_HOST || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname);
    const port = import.meta.env.VITE_PUSHER_PORT || '6001';
    const wsUrl = `${protocol}//${host}:${port}`;
    
    try {
      this.connection = new WebSocket(wsUrl);
      
      this.connection.onopen = () => {
        console.log('[WebSocket] Connected to local WebSocket server');
        this.connected = true;
        this.retryCount = 0; // Reset retry count on successful connection
        this.emit('connected');
      };
      
      this.connection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      this.connection.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
        this.emit('disconnected');
        
        // Attempt to reconnect with backoff, but limit retries
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          const delay = Math.min(this.retryDelay * Math.pow(2, this.retryCount - 1), 30000);
          setTimeout(() => this.connect(), delay);
        }
      };
      
      this.connection.onerror = (error) => {
        if (this.retryCount === 0) {
          console.error('[WebSocket] Connection error:', error);
        }
        this.emit('error', error);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      this.emit('error', error);
    }
  }
  
  handleMessage(data) {
    const { event, channel, payload } = data;
    
    if (channel && this.channels.has(channel)) {
      const channelHandlers = this.channels.get(channel);
      if (channelHandlers.has(event)) {
        channelHandlers.get(event).forEach(handler => {
          try {
            handler(payload);
          } catch (error) {
            console.error(`[WebSocket] Error in handler for ${event}:`, error);
          }
        });
      }
    }
  }
  
  channel(channelName) {
    return {
      listen: (event, handler) => {
        if (!this.channels.has(channelName)) {
          this.channels.set(channelName, new Map());
        }
        
        const channelHandlers = this.channels.get(channelName);
        if (!channelHandlers.has(event)) {
          channelHandlers.set(event, new Set());
        }
        
        channelHandlers.get(event).add(handler);
        
        // Return unsubscribe function
        return () => {
          const handlers = channelHandlers.get(event);
          if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
              channelHandlers.delete(event);
            }
            if (channelHandlers.size === 0) {
              this.channels.delete(channelName);
            }
          }
        };
      },
      
      stopListening: (event) => {
        if (this.channels.has(channelName)) {
          this.channels.get(channelName).delete(event);
        }
      }
    };
  }
  
  emit(event, data) {
    // For internal events (connected, disconnected, error)
    if (this.channels.has('internal')) {
      const handlers = this.channels.get('internal');
      if (handlers.has(event)) {
        handlers.get(event).forEach(handler => handler(data));
      }
    }
  }
  
  disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.connected = false;
  }
}

// Echo-like interface for compatibility
class Echo {
  constructor(options) {
    this.options = options;
    this.ws = new LocalWebSocket(options);
  }
  
  channel(channelName) {
    return {
      listen: (event, handler) => {
        return this.ws.channel(channelName).listen(event, handler);
      },
      
      stopListening: (event) => {
        this.ws.channel(channelName).stopListening(event);
      }
    };
  }
  
  leaveChannel(channelName) {
    this.ws.channels.delete(channelName);
  }
  
  get connector() {
    return {
      pusher: {
        connection: {
          bind: (event, handler) => {
            return this.ws.channel('internal').listen(event, handler);
          }
        }
      }
    };
  }
}

// Subscribe to reservation updates
export function subscribeToReservationUpdates(callback, options = {}) {
  const { onStatusChange } = options;
  const echo = new Echo();
  const channel = echo.channel('reservations');

  const eventHandlers = [
    channel.listen('ReservationCreated', (payload) => callback({ event: 'ReservationCreated', payload })),
    channel.listen('ReservationUpdated', (payload) => callback({ event: 'ReservationUpdated', payload })),
    channel.listen('ReservationDeleted', (payload) => callback({ event: 'ReservationDeleted', payload })),
    // Backward compatibility with legacy event naming.
    channel.listen('updated', (payload) => callback({ event: 'updated', payload })),
  ];

  const connection = echo.connector?.pusher?.connection;
  const statusHandlers = [];

  if (connection && typeof onStatusChange === 'function') {
    statusHandlers.push(connection.bind('connected', () => onStatusChange('connected')));
    statusHandlers.push(connection.bind('disconnected', () => onStatusChange('disconnected')));
    statusHandlers.push(connection.bind('error', (error) => onStatusChange('error', error)));
  }

  return () => {
    eventHandlers.forEach((unsub) => {
      if (typeof unsub === 'function') {
        unsub();
      }
    });

    statusHandlers.forEach((unsub) => {
      if (typeof unsub === 'function') {
        unsub();
      }
    });

    echo.leaveChannel('reservations');
    if (echo.ws && typeof echo.ws.disconnect === 'function') {
      echo.ws.disconnect();
    }
  };
}

export default Echo;
