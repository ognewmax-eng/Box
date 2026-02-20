import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    return 'http://localhost:3000';
  return window.location.origin;
};

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(getSocketUrl(), { transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => s.disconnect();
  }, []);

  return { socket, connected };
}
