const API = {
    BASE_URL: 'http://localhost:3000',

    async fetchWithErrorHandling(url, options = {}) {
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
    },

    async joinRoom(roomCode, username) {
        return this.fetchWithErrorHandling(
            `${this.BASE_URL}/api/rooms/${roomCode}/join`,
            {
                method: 'POST',
                body: JSON.stringify({ username })
            }
        );
    },

    async getRoomStatus(roomCode) {
        return this.fetchWithErrorHandling(
            `${this.BASE_URL}/api/rooms/${roomCode}`
        );
    },

    async startGame(roomCode, username, isAdmin) {
        const endpoint = isAdmin ? 
            `/api/admin/rooms/${roomCode}/start` : 
            `/api/rooms/${roomCode}/start`;

        return this.fetchWithErrorHandling(
            `${this.BASE_URL}${endpoint}`,
            {
                method: 'POST',
                body: JSON.stringify({ username })
            }
        );
    },

    async stopGame(roomCode, username) {
        return this.fetchWithErrorHandling(
            `${this.BASE_URL}/api/admin/rooms/${roomCode}/stop`,
            {
                method: 'POST',
                body: JSON.stringify({ username })
            }
        );
    }
};

export default API; 