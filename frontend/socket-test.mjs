import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';
const socket = io(SOCKET_URL, { transports: ['websocket'] });

socket.on('connect', () => console.log('Socket connected:', socket.id));
socket.on('missionProgress', (data) => console.log('missionProgress:', data));
socket.on('missionControl', (data) => console.log('missionControl:', data));
socket.on('disconnect', () => console.log('Socket disconnected'));
