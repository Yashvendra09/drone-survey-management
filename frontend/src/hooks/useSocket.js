// frontend/src/hooks/useSocket.js
import { useEffect } from 'react';
import { socket } from '../services/socket';

export function useSocket(event, handler) {
  useEffect(() => {
    if (!event || !handler) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}

export default socket;
