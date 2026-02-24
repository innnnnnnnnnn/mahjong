const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('Mahjong Server is running!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();
// Settings handled by client localStorage

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, playerName }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                players: [],
                status: 'WAITING',
                hostId: socket.id,
                gameState: null,
                windOfTheRound: 0
            });
        }

        const room = rooms.get(roomId);
        if (!room.players.some(p => p.socketId === socket.id) && room.players.length < 4) {
            const newPlayer = {
                id: `p${room.players.length}`,
                socketId: socket.id,
                name: playerName,
                hand: [],
                flowerCards: [],
                exposedSets: [],
                discards: [],
                isAI: false,
                isReady: true,
                isHost: false,
                score: 1000,
                streakCount: 0
            };
            room.players.push(newPlayer);
        }

        if (room.players.length > 0) {
            const firstHumanIdx = room.players.findIndex(p => !p.isAI);
            if (firstHumanIdx !== -1) {
                room.hostId = room.players[firstHumanIdx].socketId;
                room.players.forEach((p, idx) => {
                    p.isHost = (idx === firstHumanIdx);
                });
            }
        }

        console.log(`Room ${roomId} updated. Players: ${room.players.length}. Host: ${room.hostId}`);
        io.to(roomId).emit('room_update', room);
    });

    const removePlayerFromRoom = (socketId) => {
        rooms.forEach((room, roomId) => {
            const playerIdx = room.players.findIndex(p => p.socketId === socketId);
            if (playerIdx !== -1) {
                const wasHost = room.players[playerIdx].isHost;
                room.players.splice(playerIdx, 1);
                if (room.players.filter(p => !p.isAI).length === 0) {
                    rooms.delete(roomId);
                } else {
                    if (wasHost) {
                        const firstHumanIdx = room.players.findIndex(p => !p.isAI);
                        if (firstHumanIdx !== -1) {
                            room.hostId = room.players[firstHumanIdx].socketId;
                            room.players.forEach((p, idx) => {
                                p.isHost = (idx === firstHumanIdx);
                            });
                        }
                    }
                    io.to(roomId).emit('room_update', room);
                }
            }
        });
    };

    socket.on('leave_room', (roomId) => {
        removePlayerFromRoom(socket.id);
        socket.leave(roomId);
    });

    socket.on('player_ready', ({ roomId, isReady }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.isReady = isReady;
                io.to(roomId).emit('room_update', room);
            }
        }
    });

    socket.on('add_ai', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players.length < 4) {
            const aiIdx = room.players.length;
            room.players.push({
                id: `ai${aiIdx}`,
                socketId: null,
                name: `AI ${['東', '南', '西', '北'][aiIdx]}`,
                hand: [],
                flowerCards: [],
                exposedSets: [],
                discards: [],
                isAI: true,
                isReady: true,
                score: 1000,
                streakCount: 0
            });
            io.to(roomId).emit('room_update', room);
        }
    });

    socket.on('start_game', (data) => {
        if (!data) return;
        const roomId = typeof data === 'string' ? data : data.roomId;
        const room = rooms.get(roomId);
        const isContinuation = data.isContinuation || false;

        if (room && room.players.length >= 1) {
            while (room.players.length < 4) {
                const aiIdx = room.players.length;
                room.players.push({
                    id: `ai${aiIdx}`,
                    socketId: null,
                    name: `AI ${['東', '南', '西', '北'][aiIdx]}`,
                    hand: [],
                    flowerCards: [],
                    exposedSets: [],
                    discards: [],
                    isAI: true,
                    isReady: true,
                    score: 1000,
                    streakCount: 0
                });
            }

            if (!isContinuation) {
                // Reset all player stats for a fresh game
                room.players.forEach(p => {
                    p.score = 1000;
                    p.streakCount = 0;
                });
                room.windOfTheRound = 0;
            }

            if (data.windOfTheRound !== undefined) {
                room.windOfTheRound = data.windOfTheRound;
            }

            room.status = 'PLAYING';
            room.gameState = null;
            io.to(roomId).emit('game_started', {
                room,
                isContinuation: isContinuation,
                dealerIdx: data.dealerIdx || 0,
                windOfTheRound: room.windOfTheRound
            });
        }
    });

    socket.on('game_action', ({ roomId, action, data }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.gameState = data;
            if (data && data.players) {
                data.players.forEach(p => {
                    const player = room.players.find(rp => rp.id === p.id);
                    if (player) {
                        player.score = p.score;
                        player.streakCount = p.streakCount;
                    }
                });
            }
            if (data && data.windOfTheRound !== undefined) {
                room.windOfTheRound = data.windOfTheRound;
            }
            socket.to(roomId).emit('sync_state', { action, data });
        }
    });

    socket.on('disconnect', () => {
        removePlayerFromRoom(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket server running on port ${PORT}`);
});
