class GameBot {
    constructor(name = 'Bot') {
        this.name = `${name}_${Math.floor(Math.random() * 1000)}`;
        this.isBot = true;
    }

    async joinRoom(roomCode) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: this.name
                })
            });

            if (!response.ok) throw new Error('Failed to join room');
            
            console.log(`Bot ${this.name} joined room ${roomCode}`);
            return true;
        } catch (error) {
            console.error('Bot join error:', error);
            return false;
        }
    }

    async makeChallenge(roomCode, targetPlayer) {
        const challenges = [
            "You never reply to my messages!",
            "You forgot my birthday!",
            "You always borrow money but never pay back!",
            "You told my secrets to everyone!",
            "You never share your snacks!",
            "You're always late to our meetups!",
            "You cancelled plans at the last minute!",
            "You never like my social media posts!",
        ];

        const points = [10, 20, 30];
        
        try {
            const challenge = {
                target: targetPlayer,
                text: challenges[Math.floor(Math.random() * challenges.length)],
                points: points[Math.floor(Math.random() * points.length)]
            };

            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/challenge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...challenge,
                    from: this.name
                })
            });

            if (!response.ok) throw new Error('Failed to make challenge');
            
            console.log(`Bot ${this.name} challenged ${targetPlayer}`);
            return true;
        } catch (error) {
            console.error('Bot challenge error:', error);
            return false;
        }
    }

    async vote(roomCode, challengeId, vote) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    challengeId,
                    vote,
                    username: this.name
                })
            });

            if (!response.ok) throw new Error('Failed to vote');
            
            console.log(`Bot ${this.name} voted ${vote} on challenge ${challengeId}`);
            return true;
        } catch (error) {
            console.error('Bot vote error:', error);
            return false;
        }
    }
} 