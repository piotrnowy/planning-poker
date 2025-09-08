// Front-end logic for the Planning Poker application.

(() => {
  const joinSection = document.getElementById('join-section');
  const appSection = document.getElementById('app-section');
  const roomInput = document.getElementById('room-id-input');
  const nameInput = document.getElementById('user-name-input');
  const joinButton = document.getElementById('join-button');
  const cardsContainer = document.getElementById('cards');
  const votesContainer = document.getElementById('votes');
  const averageEl = document.getElementById('average');
  const revealButton = document.getElementById('reveal-button');
  const resetButton = document.getElementById('reset-button');
  const roomLabel = document.getElementById('room-label');
  const copyLinkButton = document.getElementById('copy-link-button');

  // Define the values used for planning poker. You can customize this list
  // to match whatever sequence your team prefers.
  const cardValues = [
    '0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?' 
  ];

  let socket = null;
  let currentRoomId = null;
  let currentUser = null;
  let selectedValue = null;

  // Create card elements and append them to the container.
  function renderCards() {
    cardsContainer.innerHTML = '';
    cardValues.forEach((val) => {
      const card = document.createElement('div');
      card.classList.add('card');
      card.textContent = val;
      card.addEventListener('click', () => {
        if (!socket) return;
        selectedValue = val;
        sendVote(val);
        updateSelectedCard();
      });
      cardsContainer.appendChild(card);
    });
  }

  function updateSelectedCard() {
    // Remove selection from all cards then mark the selected one
    const cards = document.querySelectorAll('.card');
    cards.forEach((card) => {
      card.classList.toggle('selected', card.textContent === selectedValue);
    });
  }

  // Join button handler
  joinButton.addEventListener('click', () => {
    const roomId = (roomInput.value || '').trim();
    const userName = (nameInput.value || '').trim();
    if (!roomId) {
      alert('Please enter a room ID');
      return;
    }
    if (!userName) {
      alert('Please enter your name');
      return;
    }
    currentRoomId = roomId;
    currentUser = userName;
    connectWebSocket(roomId, userName);
  });

  // Copy link handler
  copyLinkButton.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('roomId', currentRoomId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      copyLinkButton.textContent = 'Copied!';
      setTimeout(() => (copyLinkButton.textContent = 'Copy Link'), 1500);
    });
  });

  // Reveal and reset handlers
  revealButton.addEventListener('click', () => {
    sendMessage({ type: 'reveal' });
  });

  resetButton.addEventListener('click', () => {
    selectedValue = null;
    updateSelectedCard();
    sendMessage({ type: 'reset' });
  });

  // Connect to the WebSocket server
  function connectWebSocket(roomId, userName) {
    // Determine correct WebSocket scheme based on current protocol
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${loc.host}/ws?roomId=${encodeURIComponent(roomId)}&user=${encodeURIComponent(userName)}`;

    socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => {
      // Transition UI to the app view
      joinSection.classList.add('hidden');
      appSection.classList.remove('hidden');
      roomLabel.textContent = `Room: ${roomId}`;
      renderCards();
    });
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
          updateVotesDisplay(data.votes, data.revealed);
        }
      } catch (e) {
        console.error('Invalid message', e);
      }
    });
    socket.addEventListener('close', () => {
      // If connection drops, reset UI
      alert('Connection closed');
      joinSection.classList.remove('hidden');
      appSection.classList.add('hidden');
    });
  }

  function sendMessage(msg) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(msg));
  }

  function sendVote(val) {
    sendMessage({ type: 'vote', value: val });
  }

  function updateVotesDisplay(votes, revealed) {
    // Build the list of vote rows
    votesContainer.innerHTML = '';
    const names = Object.keys(votes);
    let total = 0;
    let count = 0;
    names.forEach((name) => {
      const row = document.createElement('div');
      row.classList.add('vote-row');
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('name');
      nameSpan.textContent = name;
      const valueSpan = document.createElement('span');
      valueSpan.classList.add('value');
      const val = votes[name];
      if (revealed) {
        valueSpan.textContent = val;
        const numeric = parseFloat(val);
        if (!isNaN(numeric)) {
          total += numeric;
          count += 1;
        }
      } else {
        valueSpan.textContent = selectedValue && name === currentUser ? val : '?';
      }
      row.appendChild(nameSpan);
      row.appendChild(valueSpan);
      votesContainer.appendChild(row);
    });
    // Compute and display average if revealed
    if (revealed && count > 0) {
      const avg = total / count;
      // Round to two decimals if not integer
      const rounded = Math.round(avg * 100) / 100;
      averageEl.textContent = `Average: ${rounded}`;
    } else {
      averageEl.textContent = '';
    }
  }

  // Prefill room id from query string if present
  (function initFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const roomIdParam = params.get('roomId');
    if (roomIdParam) {
      roomInput.value = roomIdParam;
      // Generate a random username suggestion
      const randomSuffix = Math.floor(Math.random() * 1000);
      nameInput.value = `User${randomSuffix}`;
    }
  })();
})();
