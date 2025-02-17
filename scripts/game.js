// Constants
const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? '/api'  // Will be prefixed with Vercel URL
    : 'http://localhost:3000';
const GAME_PHASES = {
    JOINING: 1,
    CHALLENGE: 2,
    VOTING: 3
};
const UPDATE_INTERVAL = 1000;

// State management
const gameState = {
    currentRoom: null,
    currentUser: null,
    selectedPoints: null,
    timerInterval: null,
    isCreator: false
};

// Event Handlers
document.addEventListener('DOMContentLoaded', initializeGame);
window.addEventListener('beforeunload', handleBeforeUnload);

// Initialize game
async function initializeGame() {
    gameState.currentUser = JSON.parse(localStorage.getItem('user'));
    if (!gameState.currentUser) {
        window.location.href = '/index.html';
        return;
    }

    const roomCode = new URLSearchParams(window.location.search).get('room');
    if (roomCode) {
        localStorage.setItem('lastRoom', roomCode);
        await joinGameRoom(roomCode);
        startGameUpdates();
    }
}

// API calls
async function fetchWithErrorHandling(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Game room management
async function joinGameRoom(roomCode) {
    try {
        const joinData = await fetchWithErrorHandling(
            `${API_BASE_URL}/api/rooms/${roomCode}/join`,
            {
                method: 'POST',
                body: JSON.stringify({ username: gameState.currentUser.username })
            }
        );

        handleJoinResponse(joinData);
    } catch (error) {
        handleJoinError(error);
    }
}

function handleJoinResponse(data) {
    if (data.roomFull || data.gameStarted) {
        showErrorAndRedirect(
            data.roomFull ? 'Room is full' : 'Game already started'
        );
        return;
    }

    gameState.currentRoom = data.room;
    if (data.gameStarted || gameState.currentRoom.isStarted) {
        handleGameStart();
    }
    updateUI();
}

// UI Updates
function updateUI() {
    const elements = {
        roomName: document.querySelector('.room-name'),
        phases: document.querySelectorAll('.phase'),
        playersList: document.getElementById('playersList'),
        challengeContainer: document.querySelector('.challenge-container'),
        challengesList: document.querySelector('.challenges-list'),
        votingContainer: document.querySelector('.voting-container')
    };

    updateBasicInfo(elements);
    updatePhaseIndicator(elements.phases);
    updatePlayersList(elements.playersList);
    updateGamePhaseUI(elements);
    updateGameControls();
}

function updateBasicInfo(elements) {
    elements.roomName.textContent = gameState.currentRoom.name;
    gameState.isCreator = gameState.currentUser.username === gameState.currentRoom.creator;
}

function updatePhaseIndicator(phases) {
    phases.forEach(phase => {
        const phaseNum = parseInt(phase.dataset.phase);
        phase.classList.toggle('active', phaseNum === gameState.currentRoom.phase);
    });
}

function updatePlayersList(playersList) {
    playersList.innerHTML = '';

    gameState.currentRoom.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        // Add role-specific class
        if (player.role) {
            playerCard.classList.add(`role-${player.role}`);
        }

        const roleIcon = player.role === 'challenger' ? '👨‍⚖️' : '👤';
        const isCurrentPlayer = player.username === gameState.currentUser.username;
        
        playerCard.innerHTML = `
            <div class="player-info">
                <div class="player-header">
                    <span class="role-icon" title="${player.role || 'Waiting...'}">${roleIcon}</span>
                    <div class="player-name ${isCurrentPlayer ? 'current-player' : ''}">
                        ${player.username}
                        ${isCurrentPlayer ? ' (You)' : ''}
                    </div>
                    ${player.ready ? '<span class="ready-icon">✓</span>' : ''}
                </div>
                <div class="health-bar">
                    <div class="health-fill" style="width: ${player.health}%"></div>
                    <span class="health-text">${player.health}HP</span>
                </div>
            </div>
            <div class="player-status">
                ${player.role === 'challenger' ? '<span class="challenger-badge">Challenger</span>' : ''}
            </div>
        `;
        playersList.appendChild(playerCard);
    });

    updateChallengeForm();
}

function updateChallengeForm() {
    const currentPlayer = gameState.currentRoom.players.find(
        p => p.username === gameState.currentUser.username
    );
    
    const challengeContainer = document.querySelector('.challenge-container');
    const challengeForm = document.querySelector('.challenge-form');
    
    // Only show challenge form to challenger during challenge phase
    if (currentPlayer?.role === 'challenger' && gameState.currentRoom.phase === 2) {
        challengeContainer.style.display = 'block';
        updateTargetPlayerSelect();
    } else {
        challengeContainer.style.display = 'none';
    }
}

function updateTargetPlayerSelect() {
    const select = document.getElementById('targetPlayer');
    select.innerHTML = '<option value="">Select a player to challenge</option>';
    
    gameState.currentRoom.players.forEach(player => {
        if (player.username !== gameState.currentUser.username) {
            select.innerHTML += `
                <option value="${player.username}">${player.username}</option>
            `;
        }
    });
}

function updateGamePhaseUI(elements) {
    elements.challengeContainer.style.display = gameState.currentRoom.phase === 2 ? 'block' : 'none';
    elements.challengesList.style.display = gameState.currentRoom.phase >= 2 ? 'block' : 'none';
    elements.votingContainer.style.display = gameState.currentRoom.phase === 3 ? 'block' : 'none';

    if (gameState.currentRoom.phase >= 2) {
        updateChallengesList();
    }
}

function updateChallengesList() {
    const challengesList = document.getElementById('challengesList');
    challengesList.innerHTML = '';

    gameState.currentRoom.players.forEach(player => {
        player.challenges.forEach(challenge => {
            const challengeItem = document.createElement('div');
            challengeItem.className = 'challenge-item';
            challengeItem.innerHTML = `
                <div class="challenge-header">
                    <span>${challenge.from} → ${player.username}</span>
                    <span class="challenge-points">${challenge.points} points</span>
                </div>
                <div class="challenge-text">${challenge.text}</div>
                <div class="challenge-status">${challenge.status}</div>
            `;
            challengesList.appendChild(challengeItem);
        });
    });
}

// Event Listeners
document.querySelectorAll('.points-buttons button').forEach(button => {
    button.addEventListener('click', () => {
        gameState.selectedPoints = parseInt(button.dataset.points);
        document.querySelectorAll('.points-buttons button').forEach(btn => {
            btn.classList.toggle('selected', btn === button);
        });
    });
});

document.getElementById('submitChallenge').addEventListener('click', async () => {
    const targetPlayer = document.getElementById('targetPlayer').value;
    const challengeText = document.getElementById('challengeText').value;

    if (!targetPlayer || !challengeText || !gameState.selectedPoints) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${gameState.currentRoom.code}/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: gameState.currentUser.username,
                to: targetPlayer,
                text: challengeText,
                points: gameState.selectedPoints
            })
        });

        if (!response.ok) throw new Error('Failed to submit challenge');
        
        document.getElementById('targetPlayer').value = '';
        document.getElementById('challengeText').value = '';
        gameState.selectedPoints = null;
        document.querySelectorAll('.points-buttons button').forEach(btn => {
            btn.classList.remove('selected');
        });
    } catch (error) {
        alert('Error submitting challenge');
    }
});

// Game updates
function startGameUpdates() {
    setInterval(async () => {
        if (!gameState.currentRoom?.code) return;
        try {
            const data = await fetchWithErrorHandling(
                `${API_BASE_URL}/api/rooms/${gameState.currentRoom.code}`
            );
            handleGameUpdate(data);
        } catch (error) {
            handleUpdateError(error);
        }
    }, UPDATE_INTERVAL);
}

function handleGameStart() {
    const elements = {
        challengeContainer: document.querySelector('.challenge-container'),
        challengesList: document.querySelector('.challenges-list')
    };

    elements.challengeContainer.style.display = 'block';
    elements.challengesList.style.display = 'block';
    updatePhaseIndicator(document.querySelectorAll('.phase'));
}

function handleBeforeUnload(e) {
    if (gameState.currentRoom?.isStarted) {
        e.preventDefault();
        e.returnValue = 'Game is in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
}

// Leave game functionality
function leaveGame() {
    bots = []; // Clear bots when leaving
    updateBotCount();
    const modal = document.getElementById('confirmLeaveModal');
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    
    // Show room code in modal
    if (roomCodeDisplay && gameState.currentRoom?.code) {
        roomCodeDisplay.textContent = gameState.currentRoom.code;
    }
    
    // Show modal with animation
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
}

function hideConfirmLeave() {
    const modal = document.getElementById('confirmLeaveModal');
    
    // Hide with fade out animation
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function confirmLeave() {
    // Store room code for potential rejoin
    if (gameState.currentRoom?.code) {
        localStorage.setItem('lastRoom', gameState.currentRoom.code);
    }
    
    // Show leaving message
    const modal = document.getElementById('confirmLeaveModal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <h3>Leaving Game...</h3>
        <p>Redirecting to lobby</p>
    `;
    
    // Redirect after short delay
    setTimeout(() => {
        window.location.href = '/lobby.html';
    }, 1000);
}

// Utility functions
function showError(message, autoHide = false) {
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorContainer.style.display = 'flex';

    if (autoHide) {
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 3000);
    }
}

function showErrorAndRedirect(message) {
    showError(message);
    setTimeout(() => window.location.href = '/lobby.html', 3000);
}

function updateGameControls() {
    const timerDisplay = document.getElementById('timerDisplay');
    const startControls = document.getElementById('startControls');
    const startGameBtn = document.getElementById('startGameBtn');
    const stopGameBtn = document.getElementById('stopGameBtn');
    const currentPlayers = document.getElementById('currentPlayers');
    const maxPlayers = document.getElementById('maxPlayers');

    const isAdmin = gameState.currentUser.isAdmin === true;
    
    // Update player count
    currentPlayers.textContent = gameState.currentRoom.players.length;
    maxPlayers.textContent = gameState.currentRoom.maxPlayers;

    // Show controls based on game state and admin status
    startControls.style.display = isAdmin ? 'flex' : 'none';
    
    if (gameState.currentRoom.isStarted) {
        // Show stop button only for admin when game is in progress
        if (isAdmin) {
            startGameBtn.style.display = 'none';
            stopGameBtn.style.display = 'block';
        } else {
            startControls.style.display = 'none';
        }
        timerDisplay.textContent = 'Game in progress';
        clearInterval(gameState.timerInterval);
        handleGameStart();
    } else {
        // Show start button for admin or creator when game hasn't started
        startGameBtn.style.display = (gameState.isCreator || isAdmin) ? 'block' : 'none';
        stopGameBtn.style.display = 'none';
        
        if (startGameBtn) {
            startGameBtn.disabled = !isAdmin && gameState.currentRoom.players.length < 2;
            startGameBtn.classList.toggle('admin', isAdmin);
            startGameBtn.querySelector('.admin-badge').style.display = isAdmin ? 'inline-block' : 'none';
        }

        // Update timer display
        if (gameState.currentRoom.startTimer) {
            updateTimer(timerDisplay, new Date(gameState.currentRoom.startTimer));
        } else {
            timerDisplay.textContent = 'Waiting for players...';
        }
    }
}

function updateTimer(display, startTime) {
    clearInterval(gameState.timerInterval);
    
    gameState.timerInterval = setInterval(() => {
        const now = new Date();
        const timeElapsed = Math.floor((now - startTime) / 1000);
        const timeLeft = gameState.currentRoom.autoStartTime - timeElapsed;

        if (timeLeft <= 0) {
            display.textContent = 'Starting game...';
            clearInterval(gameState.timerInterval);
            
            // Refresh room data to get updated game state
            const roomCode = gameState.currentRoom.code;
            joinGameRoom(roomCode);
            return;
        }

        display.textContent = `Game starting in ${timeLeft} seconds`;
        display.classList.toggle('urgent', timeLeft <= 10);
    }, 1000);
}

// Update the start button event listener
document.getElementById('startGameBtn')?.addEventListener('click', async () => {
    const isAdmin = gameState.currentUser.isAdmin === true;
    
    if (!gameState.isCreator && !isAdmin) return;

    try {
        const endpoint = isAdmin ? 
            `${API_BASE_URL}/api/admin/rooms/${gameState.currentRoom.code}/start` : 
            `${API_BASE_URL}/api/rooms/${gameState.currentRoom.code}/start`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username: gameState.currentUser.username })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.error('Error parsing start game response:', e);
            showError('Invalid server response. Please try again.');
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || 'Failed to start game');
        }
    } catch (error) {
        console.error('Error starting game:', error);
        showError(error.message);
    }
});

// Add stop game event listener
document.getElementById('stopGameBtn')?.addEventListener('click', async () => {
    if (!gameState.currentUser.isAdmin) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/rooms/${gameState.currentRoom.code}/stop`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username: gameState.currentUser.username })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.error('Error parsing stop game response:', e);
            showError('Invalid server response. Please try again.');
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || 'Failed to stop game');
        }

        // Update room data
        gameState.currentRoom = data.room;
        updateUI();
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Game stopped successfully';
        document.body.appendChild(successMessage);
        setTimeout(() => successMessage.remove(), 3000);
    } catch (error) {
        console.error('Error stopping game:', error);
        showError(error.message);
    }
});

// Add bot management functions
async function addBot() {
    const bot = new GameBot();
    const roomCode = gameState.currentRoom.code;
    
    if (await bot.joinRoom(roomCode)) {
        bots.push(bot);
        updateBotCount();
        
        // Make bot ready after joining
        setTimeout(async () => {
            if (gameState.currentRoom?.phase === 1) {
                await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/ready`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: bot.name
                    })
                });
            }
        }, 1000);
    }
}

function updateBotCount() {
    const botCountElement = document.getElementById('botCount');
    if (botCountElement) {
        botCountElement.textContent = bots.length;
    }
}

// Update handleGameUpdate to include bot actions
function handleGameUpdate(data) {
    gameState.currentRoom = data;
    updateUI();

    // Bot actions based on game phase
    bots.forEach(async (bot) => {
        if (data.phase === 2 && bot.role === 'challenger') {
            // Bot makes a challenge
            const players = data.players.filter(p => p.username !== bot.name);
            if (players.length > 0) {
                const target = players[Math.floor(Math.random() * players.length)];
                await bot.makeChallenge(data.code, target.username);
            }
        } else if (data.phase === 3) {
            // Bot votes on challenges
            data.challenges.forEach(async (challenge) => {
                if (!challenge.votes?.includes(bot.name)) {
                    await bot.vote(data.code, challenge.id, Math.random() > 0.5);
                }
            });
        }
    });
}

function handleUpdateError(error) {
    console.error('Error updating game state:', error);
    clearInterval(gameState.timerInterval);
    
    if (error.message.includes('Room not found')) {
        showError('Room no longer exists');
        setTimeout(() => window.location.href = '/lobby.html', 3000);
    }
}

function handleJoinError(error) {
    console.error('Error joining game room:', error);
    showError(error.message || 'Error joining game room');
    setTimeout(() => window.location.href = '/lobby.html', 3000);
} 