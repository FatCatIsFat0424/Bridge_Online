import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import { SERVER_URL, SOCKET_PATH } from './deployment';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  path: SOCKET_PATH,
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export function connectSocket(): void {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
  socket.disconnect();
}
