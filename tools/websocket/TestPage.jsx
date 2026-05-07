import React, { useState, useEffect } from "react";

function TestPage() {
  const [data, setData] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");

  useEffect(() => {
    // Test API
    fetch('http://localhost:8000/api/admin/reservations?per_page=50')
      .then(response => response.json())
      .then(result => {
        console.log('API Data:', result);
        setData(result);
      })
      .catch(error => {
        console.error('API Error:', error);
      });

    // Test WebSocket
    const ws = new WebSocket('ws://localhost:6001');
    
    ws.onopen = () => {
      console.log('WebSocket Connected');
      setWsStatus("connected");
    };
    
    ws.onmessage = (event) => {
      console.log('WebSocket Message:', JSON.parse(event.data));
    };
    
    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setWsStatus("disconnected");
    };

    return () => {
      <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
        <h1>Test Page</h1>
        <p>WebSocket Status: {wsStatus}</p>
        <p>API Data: {data ? `Loaded ${data.data?.length || 0} records` : 'Loading...'}</p>
        {data && (
          <div>
            <h2>First 5 Records:</h2>
            <ul>
              {data.data?.slice(0, 5).map((item, index) => (
                <li key={index}>
                  {item.name} - {item.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
}

export default TestPage;
