// Add this at the top of the file
const API_BASE_URL = 'http://localhost:3000'; // Remove process.env.PORT

// Add these variables at the top
let currentRooms = []; // Store all rooms
let selectedPlayerCount = 'all'; // Store current filter
let isAdmin = false;

// Check if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    
    // Check if user is admin from localStorage
    isAdmin = user.isAdmin === true;
    if (isAdmin) {
        document.getElementById('adminPanel').style.display = 'block';
        loadOnlineUsers();
    }
    
    // Update username displays
    document.getElementById('username').textContent = user.username;
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileEmail').textContent = user.email;
    
    // Start room refresh
    startRoomRefresh();

    // Check for last room
    const lastRoom = localStorage.getItem('lastRoom');
    if (lastRoom) {
        document.getElementById('rejoinBtn').style.display = 'block';
    }
});

// Load available rooms
async function loadRooms() {
    showLoading();
    try {
        console.log('Fetching rooms from:', `${API_BASE_URL}/api/rooms`);
        const response = await fetch(`${API_BASE_URL}/api/rooms`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const rooms = await response.json();
        console.log('Loaded rooms:', rooms);
        
        if (!Array.isArray(rooms)) {
            throw new Error('Invalid response format - expected array');
        }
        
        currentRooms = rooms; // Store rooms
        displayRooms(rooms); // Display all rooms first
        filterRooms(); // Then apply any filters
    } catch (error) {
        console.error('Error loading rooms:', error);
        displayError(error.message);
    }
}

// Add room filtering function
function filterRooms() {
    const playerFilter = document.getElementById('playerFilter');
    selectedPlayerCount = playerFilter.value;
    
    let filteredRooms = currentRooms;
    if (selectedPlayerCount !== 'all') {
        filteredRooms = currentRooms.filter(room => 
            room.maxPlayers === parseInt(selectedPlayerCount)
        );
    }
    
    displayRooms(filteredRooms);
}

// Display rooms in the list
function displayRooms(rooms) {
    const roomList = document.getElementById('roomList');
    const noRooms = document.getElementById('noRooms');
    const roomCount = document.getElementById('roomCount');
    const currentUser = JSON.parse(localStorage.getItem('user'))?.username;
    
    roomList.innerHTML = '';
    
    if (!Array.isArray(rooms) || rooms.length === 0) {
        roomList.style.display = 'none';
        noRooms.style.display = 'block';
        roomCount.textContent = 'No rooms available';
        return;
    }

    roomList.style.display = 'grid';
    noRooms.style.display = 'none';
    roomCount.textContent = `${rooms.length} room${rooms.length === 1 ? '' : 's'} available`;

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        
        const isCreator = currentUser === room.creator;
        
        roomElement.innerHTML = `
            <div class="room-info">
                <div class="room-header">
                    <div class="room-name">${room.name}</div>
                    ${isCreator ? `
                        <button class="delete-btn" onclick="deleteRoom('${room.code}')">
                            <span class="delete-icon">×</span>
                        </button>
                    ` : ''}
                </div>
                <div class="room-details">
                    <span class="room-code">Code: ${room.code}</span>
                    <span class="created-time">${formatTime(room.createdAt)}</span>
                </div>
                <div class="room-settings-info">
                    <span>Health: ${room.settings?.maxHealth || 100}</span>
                    <span>Damage: ${room.settings?.minDamage || 10}-${room.settings?.maxDamage || 30}</span>
                </div>
                <div class="creator-info">Created by: ${room.creator}</div>
            </div>
            <div class="room-status">
                <div class="player-count">
                    <span class="current">${room.players.length}</span>/<span class="max">${room.maxPlayers}</span> Players
                </div>
                ${!isCreator ? `
                    <button class="join-btn" onclick="joinRoom('${room.code}')"
                        ${room.players.length >= room.maxPlayers ? 'disabled' : ''}>
                        ${room.players.length >= room.maxPlayers ? 'Full' : 'Join Room'}
                    </button>
                ` : ''}
            </div>
        `;
        roomList.appendChild(roomElement);
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Show/Hide Modals
function showCreateRoom() {
    document.getElementById('createRoomModal').classList.add('active');
}

function showJoinRoom() {
    document.getElementById('joinRoomModal').classList.add('active');
}

function hideModals() {
    document.getElementById('createRoomModal').classList.remove('active');
    document.getElementById('joinRoomModal').classList.remove('active');
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.originalText = button.innerText;
        button.innerText = 'Loading...';
    } else {
        button.disabled = false;
        button.innerText = button.originalText;
    }
}

// Form Handlers
document.getElementById('createRoomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    setLoading(submitButton, true);

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert('Please login first');
            window.location.href = '/index.html';
            return;
        }

        const formData = new FormData(e.target);
        const roomData = {
            name: formData.get('roomName'),
            maxPlayers: parseInt(formData.get('maxPlayers')),
            creator: user.username,
            startTimer: parseInt(formData.get('startTimer')),
            maxHealth: parseInt(formData.get('maxHealth')),
            minDamage: parseInt(formData.get('minDamage')),
            maxDamage: parseInt(formData.get('maxDamage'))
        };

        console.log('Creating room with data:', roomData);

        const response = await fetch(`${API_BASE_URL}/api/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(roomData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to create room');
        }

        hideModals();
        await loadRooms(); // Refresh the room list
        await joinRoom(data.code); // Join the newly created room
    } catch (error) {
        console.error('Error creating room:', error);
        alert(error.message || 'Error creating room');
    } finally {
        setLoading(submitButton, false);
    }
});

document.getElementById('createRoomForm').addEventListener('input', (e) => {
    if (e.target.type === 'number') {
        const min = parseInt(e.target.min);
        const max = parseInt(e.target.max);
        let value = parseInt(e.target.value);
        
        if (isNaN(value)) value = min;
        if (value < min) value = min;
        if (value > max) value = max;
        
        e.target.value = value;
    }
});

document.getElementById('joinRoomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const roomCode = formData.get('roomCode');
    joinRoom(roomCode);
});

async function joinRoom(roomCode) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert('Please login first');
            window.location.href = '/index.html';
            return;
        }

        const endpoint = isAdmin ?
            `${API_BASE_URL}/api/admin/rooms/${roomCode}/join` :
            `${API_BASE_URL}/api/rooms/${roomCode}/join`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: user.username })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('currentRoom', roomCode);
            window.location.href = `/game.html?room=${roomCode}`;
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error joining room:', error);
        alert('Error joining room');
    }
}

// Auto-refresh rooms every 5 seconds
function startRoomRefresh() {
    loadRooms(); // Initial load
    setInterval(loadRooms, 5000);
}

function showLoading() {
    const roomList = document.getElementById('roomList');
    roomList.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Loading rooms...</p>
        </div>
    `;
}

// Add error display function
function displayError(message) {
    const roomList = document.getElementById('roomList');
    const noRooms = document.getElementById('noRooms');
    const roomCount = document.getElementById('roomCount');
    
    roomList.style.display = 'none';
    noRooms.style.display = 'block';
    noRooms.innerHTML = `
        <p class="error-message">Error: ${message}</p>
        <button class="retry-btn" onclick="loadRooms()">Retry</button>
    `;
    roomCount.textContent = 'Error loading rooms';
}

// Add delete room function
async function deleteRoom(code) {
    if (!confirm('Are you sure you want to delete this room?')) {
        return;
    }

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert('Please login first');
            return;
        }

        const endpoint = isAdmin ? 
            `${API_BASE_URL}/api/admin/rooms/${code}` : 
            `${API_BASE_URL}/api/rooms/${code}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: user.username })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to delete room');
        }

        await loadRooms();
    } catch (error) {
        console.error('Error deleting room:', error);
        alert(error.message);
    }
}

// Add admin functions
async function checkAdminStatus(username) {
    if (!isAdmin) return; // Only proceed if user is admin
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        if (response.ok) {
            loadOnlineUsers();
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

async function loadOnlineUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: JSON.parse(localStorage.getItem('user')).username })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        displayOnlineUsers(data);
    } catch (error) {
        console.error('Error loading online users:', error);
    }
}

function displayOnlineUsers(data) {
    document.getElementById('totalUsers').textContent = `Total Users: ${data.total}`;
    document.getElementById('onlineUsers').textContent = `Online: ${data.online}`;

    const usersList = document.getElementById('onlineUsersList');
    usersList.innerHTML = '';

    data.users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-info">
                <div>${user.username}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <div class="user-status ${user.online ? '' : 'offline'}"></div>
        `;
        usersList.appendChild(userCard);
    });
}

// Add rejoin function
async function rejoinLastRoom() {
    const lastRoom = localStorage.getItem('lastRoom');
    if (lastRoom) {
        await joinRoom(lastRoom);
    }
}

// Add these functions
function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    menu.classList.toggle('active');
    
    // Update profile info
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('profileUsername').textContent = user.username;
        document.getElementById('profileEmail').textContent = user.email;
    }
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('profileMenu');
    const profileBtn = document.querySelector('.profile-btn');
    
    if (!menu.contains(e.target) && !profileBtn.contains(e.target)) {
        menu.classList.remove('active');
    }
});

// Update the logout function
function logout() {
    // Show confirmation modal
    const confirmLogout = confirm('Are you sure you want to logout?');
    if (confirmLogout) {
        // Clear user data
        localStorage.removeItem('user');
        localStorage.removeItem('lastRoom');
        
        // Redirect to login
        window.location.href = '/index.html';
    }
} 