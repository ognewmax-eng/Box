import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getSocketErrorInfo } from '../utils/socketErrorCodes';

const getSocketUrl = () => {
  if (import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    return 'http://localhost:3000';
  return window.location.origin;
};

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const s = io(getSocketUrl(), { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    const onConnect = () => {
      if (mountedRef.current) {
        setConnected(true);
        setConnectionError(null);
      }
    };
    const onDisconnect = (reason) => {
      if (mountedRef.current) {
        setConnected(false);
        if (reason && reason !== 'io client disconnect') {
          setConnectionError(getSocketErrorInfo(null, reason));
        } else {
          setConnectionError(null);
        }
      }
    };
    const onConnectError = (err) => {
      if (mountedRef.current) {
        setConnected(false);
        setConnectionError(getSocketErrorInfo(err, null));
      }
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    setSocket(s);

    return () => {
      mountedRef.current = false;
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const retry = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      setConnectionError(null);
      socketRef.current.connect();
    }
  }, []);

  return { socket, connected, retry, connectionError };
}
