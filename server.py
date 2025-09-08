"""
planning-poker server

This server powers a simple Planning Poker application using aiohttp and WebSockets.
Clients connect via the WebSocket endpoint and join rooms based on a room
identifier passed as a query parameter. Each room tracks a list of connected
clients, their votes, and whether the votes have been revealed. When a client
submits a vote the server records it but keeps it hidden from other
participants until someone triggers a reveal event. Once revealed, all votes
become visible and the average is computed client side. Clients can also
reset a room which clears all stored votes and hides the previous results.

Static assets (HTML, CSS, and JavaScript) live in the ``public`` directory and
are served by the same aiohttp application. To run this server locally use:

```
python server.py
```

By default the server binds to ``0.0.0.0`` on port ``8000``. You can modify
the ``PORT`` variable at the bottom of this file if you need a different port.
"""

import json
import os
from pathlib import Path
from typing import Dict, Set

from aiohttp import web


# Path to the directory containing this script. Static files live in
# a ``public`` subdirectory relative to here. Using an absolute path
# avoids issues when run from a different working directory.
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "public"


class Room:
    """Represents a room where participants vote.

    Each room holds a set of connected WebSocket response objects, a mapping
    of client identifiers to their chosen vote value, and a flag indicating
    whether the votes have been revealed. When the last client disconnects
    the room is cleaned up automatically.
    """

    def __init__(self) -> None:
        self.clients: Set[web.WebSocketResponse] = set()
        self.votes: Dict[str, str] = {}
        self.revealed: bool = False

    def add_client(self, ws: web.WebSocketResponse) -> None:
        self.clients.add(ws)

    def remove_client(self, ws: web.WebSocketResponse) -> None:
        self.clients.discard(ws)
        # When a client leaves, remove their vote too
        for client_id, client_ws in list(self.votes.items()):
            if client_id == ws.headers.get("client-id"):
                self.votes.pop(client_id, None)
        # If no clients remain, cleanup will happen in the rooms dict outside

    def reset(self) -> None:
        """Clear all votes and hide them again."""
        self.votes.clear()
        self.revealed = False


class PlanningPokerServer:
    """Encapsulates state and handlers for a planning poker server."""

    def __init__(self) -> None:
        self.rooms: Dict[str, Room] = {}

    async def index(self, request: web.Request) -> web.Response:
        """Return the main HTML page."""
        return web.FileResponse(STATIC_DIR / "index.html")

    async def websocket_handler(self, request: web.Request) -> web.WebSocketResponse:
        """Handle incoming WebSocket connections.

        Query parameters must include ``roomId`` and ``user`` so the server
        knows which room to join and which user is associated with each vote.
        """
        room_id = request.query.get("roomId")
        user = request.query.get("user")
        if not room_id or not user:
            return web.Response(status=400, text="Missing roomId or user in query params")

        ws = web.WebSocketResponse()
        await ws.prepare(request)

        # Use a custom header to associate the WebSocket connection with a
        # specific user identifier. This header is only used server-side to
        # remove votes when a client disconnects.
        ws.headers["client-id"] = user

        # Get or create the room
        room = self.rooms.setdefault(room_id, Room())
        room.add_client(ws)

        # Send the current state to the newly connected client
        await self.send_room_state(room, ws)

        try:
            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                    except json.JSONDecodeError:
                        continue
                    action = data.get("type")
                    if action == "vote":
                        # Record the vote and broadcast
                        value = data.get("value")
                        # Save the vote keyed by user name
                        room.votes[user] = value
                        # When someone votes after a reveal, hide again and clear
                        if room.revealed:
                            room.revealed = False
                        await self.broadcast_room_state(room)
                    elif action == "reveal":
                        room.revealed = True
                        await self.broadcast_room_state(room)
                    elif action == "reset":
                        room.reset()
                        await self.broadcast_room_state(room)
                elif msg.type == web.WSMsgType.ERROR:
                    print(f'WebSocket connection closed with exception {ws.exception()}')
        finally:
            # Client disconnects: remove from room
            room.remove_client(ws)
            # If room empty, delete it
            if not room.clients:
                self.rooms.pop(room_id, None)
        return ws

    async def send_room_state(self, room: Room, ws: web.WebSocketResponse) -> None:
        """Send current state to a single client."""
        payload = {
            "type": "state",
            "votes": room.votes,
            "revealed": room.revealed,
        }
        try:
            await ws.send_json(payload)
        except ConnectionResetError:
            pass

    async def broadcast_room_state(self, room: Room) -> None:
        """Broadcast state to all clients in the room."""
        payload = {
            "type": "state",
            "votes": room.votes,
            "revealed": room.revealed,
        }
        for ws in list(room.clients):
            try:
                await ws.send_json(payload)
            except Exception:
                # Remove clients that cannot be reached
                room.remove_client(ws)



def create_app() -> web.Application:
    """Create and return the aiohttp web application."""
    server = PlanningPokerServer()
    app = web.Application()
    # Route for index page
    app.router.add_get('/', server.index)
    # Route for WebSocket endpoint
    app.router.add_get('/ws', server.websocket_handler)
    # Serve static files (CSS, JS, images)
    app.router.add_static('/static/', path=str(STATIC_DIR), name='static')
    return app


if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 8000))
    app = create_app()
    web.run_app(app, port=PORT)
