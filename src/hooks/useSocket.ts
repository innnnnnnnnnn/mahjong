import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export const useSocket = (roomId: string, playerName: string) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [roomData, setRoomData] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setIsConnected(true);
            newSocket.emit('join_room', { roomId, playerName });
        });

        newSocket.on('room_update', (data) => {
            setRoomData(data);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        return () => {
            newSocket.close();
        };
    }, [roomId, playerName]);

    const sendMessage = useCallback((type: string, data: any) => {
        if (socket) {
            socket.emit(type, data);
        }
    }, [socket]);

    return { socket, roomData, isConnected, sendMessage };
};
