# Planning Poker Web Application

This repository contains a simple Planning Poker application built using Python’s `aiohttp` library for the backend and vanilla HTML/JavaScript/CSS for the frontend.

## Features

- Create or join a room using a room ID.
- Participants submit story point estimates via an interactive card interface.
- Votes are hidden until someone clicks **Reveal**, after which all values and the average are shown.
- Reset the room to clear votes and start again.
- No authentication required — share the room URL with anyone to join.

## How it works

`server.py` defines an aiohttp web server that serves the static frontend from the `public` directory and manages WebSocket connections for each room. Each WebSocket client sends votes and control actions (`vote`, `reveal`, and `reset`). The server maintains a `Room` object per room ID, tracking connected clients, their votes, and whether the votes have been revealed. When the last client disconnects, the room is cleaned up automatically.

The `public` folder contains:

- `index.html` – The main HTML page.
- `style.css` – Styles for the interface.
- `script.js` – Client-side logic: joins rooms, renders cards, handles WebSocket communication, updates the UI, and displays votes/averages.

## Running the app locally

1. **Install Python 3 and pip** if not already installed.
2. Clone this repository:
   ```bash
   git clone https://github.com/piotrowny/planning-poker.git
   cd planning-poker
   ```
3. *(Optional)* Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: .\venv\Scripts\activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the server:
   ```bash
   python server.py
   ```
   By default it runs on port 8000. You can set a different port with the `PORT` environment variable (e.g., `PORT=5000 python server.py`).
6. Open your browser to `http://localhost:8000` (or the port you chose) and enter a room ID and username to start estimating. Share `http://localhost:8000/?roomId=<roomId>` with teammates to join the same session.
