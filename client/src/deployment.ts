export const APP_BASE_PATH = new URL(
  import.meta.env.BASE_URL,
  window.location.origin,
).pathname.replace(/\/?$/, '/');
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/+$/, '');
export const API_BASE_URL = SERVER_URL || APP_BASE_PATH.replace(/\/$/, '');
export const SOCKET_PATH =
  import.meta.env.VITE_SOCKET_PATH ?? (SERVER_URL ? '/socket.io' : `${APP_BASE_PATH}socket.io`);
