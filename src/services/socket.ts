import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD ? 'https://mahjong-zayy.onrender.com' : 'http://localhost:3001';

export const socket: Socket = io(SOCKET_URL, {
    autoConnect: false,
});

export const connectSocket = () => {
    if (!socket.connected) {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};
