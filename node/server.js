const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Rooms: { [roomId]: { clients: Map<user, ws>, votes: { [user]: value }, revealed: boolean } }
const rooms = {};

function getOrCreateRoom(id) {
  if (!rooms[id]) {
    rooms[id] = {
      clients: new Map(),
      votes: {},
      revealed: false,
    };
  }
  return rooms[id];
}

function broadcastState(room) {
  const payload = {
    type: 'state',
    votes: room.votes,
    revealed: room.revealed,
  };
  const data = JSON.stringify(payload);
  for (const ws of room.clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

wss.on('connection', (ws, req) => {
  // Parse query params from URL path (e.g. /ws?roomId=...&user=...)
  const query = req.url.replace('/?', '');
  const params = new URLSearchParams(query);
  const roomId = params.get('roomId');
  const user = params.get('user');

  if (!roomId || !user) {
    ws.close();
    return;
  }

  const room = getOrCreateRoom(roomId);
  room.clients.set(user, ws);

  // Send current state to new client
  const initPayload = {
    type: 'state',
    votes: room.votes,
    revealed: room.revealed,
  };
  ws.send(JSON.stringify(initPayload));

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }
    if (data.type === 'vote') {
      room.votes[user] = data.value;
      if (room.revealed) {
        room.revealed = false;
      }
      broadcastState(room);
    } else if (data.type === 'reveal') {
      room.revealed = true;
      broadcastState(room);
    } else if (data.type === 'reset') {
      room.votes = {};
      room.revealed = false;
      broadcastState(room);
    }
  });

  ws.on('close', () => {
    room.clients.delete(user);
    delete room.votes[user];
    if (room.clients.size === 0) {
      delete rooms[roomId];
    }
  });
});

// Serve static React app from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
