const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const path = require('path');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable mongoose debugging
mongoose.set('debug', true);

// Add this at the top of the file
mongoose.set('strictQuery', false); // Fix the deprecation warning

// MongoDB Connection with detailed error handling
const MONGODB_URI = 'mongodb+srv://cluster0.pqwf7.mongodb.net/boardgame';
console.log('Connecting to MongoDB...'); 

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    user: process.env.MONGO_USER,
    pass: process.env.MONGO_PASSWORD,
}).then(async () => {  // Make this callback async
    console.log('Connected to MongoDB successfully');
    try {
        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
        
        // Verify database name
        const dbName = mongoose.connection.db.databaseName;
        console.log('Connected to database:', dbName);
        
        // Count documents in collections
        const userCount = await User.countDocuments();
        const roomCount = await Room.countDocuments();
        console.log(`Current counts - Users: ${userCount}, Rooms: ${roomCount}`);
    } catch (err) {
        console.error('Error checking database state:', err);
    }
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Add error event handler
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

// Add this after MongoDB connection
mongoose.connection.once('open', async () => {
    try {
        // Create collections if they don't exist
        await mongoose.connection.db.createCollection('users');
        await mongoose.connection.db.createCollection('rooms');
        console.log('Collections created successfully');
        await createAdminUser(); // Create admin user
    } catch (err) {
        // Error 48 means collection already exists, which is fine
        if (err.code !== 48) {
            console.error('Error creating collections:', err);
        }
    }
});

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false }
}, {
    collection: 'users' // Explicitly set collection name
});

const User = mongoose.model('User', userSchema);

// Room Schema
const roomSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    maxPlayers: { type: Number, required: true },
    creator: { type: String, required: true },
    players: [{
        username: String,
        ready: { type: Boolean, default: false },
        health: { type: Number, default: 100 },
        role: { type: String, enum: ['challenger', 'player'], default: 'player' },
        isBot: { type: Boolean, default: false },
        challenges: [{
            from: String,
            text: String,
            points: Number,
            status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
        }],
        joinedAt: { type: Date, default: Date.now }
    }],
    phase: { type: Number, default: 1 }, // 1: Joining, 2: Challenge, 3: Voting
    status: { type: String, default: 'waiting' },
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    startTimer: { type: Date }, // When timer was started
    autoStartTime: { type: Number, default: 60, min: 30, max: 300 },
    isStarted: { type: Boolean, default: false },
    creatorCanStart: { type: Boolean, default: true }, // Allow creator to start early
    settings: {
        maxHealth: { type: Number, default: 100, min: 50, max: 200 },
        minDamage: { type: Number, default: 10, min: 5, max: 50 },
        maxDamage: { type: Number, default: 30, min: 10, max: 100 }
    }
}, {
    collection: 'rooms' // Explicitly set collection name
});

const Room = mongoose.model('Room', roomSchema);

// Update the checkAndStartGame method
roomSchema.methods.checkAndStartGame = async function() {
    // Start game if room is full or timer has expired
    const now = new Date();
    const shouldStart = 
        (this.players.length >= this.maxPlayers) || 
        (this.startTimer && (now - new Date(this.startTimer)) / 1000 >= this.autoStartTime);

    if (shouldStart && !this.isStarted) {
        console.log(`Starting game in room ${this.code}. Players: ${this.players.length}/${this.maxPlayers}`);
        this.isStarted = true;
        this.phase = 2; // Move to Challenge phase
        await this.save();
        return true;
    }
    return false;
};

// Add periodic check for game start conditions
async function checkRoomsForAutoStart() {
    try {
        const waitingRooms = await Room.find({ 
            isStarted: false,
            status: 'waiting',
            startTimer: { $ne: null }
        });

        for (const room of waitingRooms) {
            await room.checkAndStartGame();
        }
    } catch (error) {
        console.error('Error checking rooms for auto-start:', error);
    }
}

// Run auto-start check every second
setInterval(checkRoomsForAutoStart, 1000);

// API Routes
const apiRouter = express.Router();

apiRouter.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        console.log('Registration attempt:', { username, email });
        
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            console.log('User already exists:', existingUser.username);
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });

        const savedUser = await user.save();
        console.log('User registered successfully:', savedUser.username);
        
        res.status(201).json({ 
            message: 'User registered successfully',
            user: {
                username: savedUser.username,
                email: savedUser.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: 'Error registering user',
            error: error.message
        });
    }
});

apiRouter.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', req.body);
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const user = await User.findOne({ username });
        console.log('User found:', user ? 'Yes' : 'No');

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password valid:', validPassword);

        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        res.json({ 
            message: 'Login successful',
            user: {
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
});

apiRouter.get('/rooms', async (req, res) => {
    console.log('GET /api/rooms - Fetching rooms');
    try {
        const rooms = await Room.find({ 
            status: 'waiting'
        }).sort({ createdAt: -1 });
        
        console.log('Found rooms:', rooms);
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Error fetching rooms' });
    }
});

apiRouter.post('/rooms', async (req, res) => {
    console.log('POST /api/rooms - Creating room:', req.body);
    try {
        const { 
            name, 
            maxPlayers, 
            creator,
            startTimer,
            maxHealth,
            minDamage,
            maxDamage 
        } = req.body;

        // Validate input
        if (!name || !maxPlayers || !creator) {
            return res.status(400).json({ 
                message: 'Missing required fields'
            });
        }

        const code = generateRoomCode();
        
        const room = new Room({
            code,
            name,
            maxPlayers: parseInt(maxPlayers),
            creator,
            players: [{ username: creator, ready: false }],
            status: 'waiting',
            settings: {
                autoStartTime: parseInt(startTimer) || 60,
                maxHealth: parseInt(maxHealth) || 100,
                minDamage: parseInt(minDamage) || 10,
                maxDamage: parseInt(maxDamage) || 30
            }
        });

        const savedRoom = await room.save();
        res.status(201).json({ 
            code, 
            message: 'Room created successfully',
            room: savedRoom
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Error creating room' });
    }
});

apiRouter.post('/rooms/:code/join', async (req, res) => {
    try {
        const { code } = req.params;
        const { username } = req.body;

        console.log('Join attempt:', { code, username });

        if (!code || !username) {
            return res.status(400).json({ 
                message: 'Room code and username are required'
            });
        }

        const room = await Room.findOne({ code });
        if (!room) {
            return res.status(404).json({ 
                message: 'Room not found',
                code 
            });
        }

        // Check if game is already started
        if (room.isStarted) {
            return res.status(403).json({ 
                message: 'Game has already started',
                gameStarted: true
            });
        }

        // Check if room is full
        if (room.players.length >= room.maxPlayers) {
            return res.status(403).json({ 
                message: 'Room is full',
                roomFull: true
            });
        }

        // Check if player is already in room
        const existingPlayer = room.players.find(p => p.username === username);
        if (existingPlayer) {
            // If player is already in room, just return the room data
            return res.json({ 
                message: 'Already in room',
                room
            });
        }

        // Add new player
        room.players.push({ 
            username, 
            ready: false,
            health: 100,
            joinedAt: new Date()
        });
        
        // Start timer when room is almost full
        if (room.players.length === room.maxPlayers - 1 && !room.startTimer) {
            room.startTimer = new Date();
            console.log(`Starting timer for room ${code}`);
        }

        // Check if should auto-start
        const gameStarted = await room.checkAndStartGame();
        console.log(`Game start check for room ${code}: ${gameStarted}`);

        await room.save();
        
        res.json({ 
            message: 'Joined room successfully',
            gameStarted,
            room
        });
    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({ 
            message: 'Error joining room',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

apiRouter.get('/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;
        console.log('Getting room:', code);

        const room = await Room.findOne({ code });
        if (!room) {
            console.log('Room not found:', code);
            return res.status(404).json({ message: 'Room not found' });
        }

        res.json(room);
    } catch (error) {
        console.error('Error getting room:', error);
        res.status(500).json({ message: 'Error getting room' });
    }
});

apiRouter.delete('/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { username } = req.body;

        const room = await Room.findOne({ code });
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Only allow creator to delete room
        if (room.creator !== username) {
            return res.status(403).json({ message: 'Only the room creator can delete the room' });
        }

        await Room.deleteOne({ code });
        console.log(`Room ${code} deleted by ${username}`);
        
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ message: 'Error deleting room' });
    }
});

// Add admin check middleware
const isAdmin = async (req, res, next) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking admin status' });
    }
};

// Add admin routes
apiRouter.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }); // Exclude passwords
        const onlineUsers = users.filter(user => {
            // Check if user has active room or recent activity
            return true; // You can implement more sophisticated online check
        });
        
        res.json({
            total: users.length,
            online: onlineUsers.length,
            users: onlineUsers
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Admin can delete any room
apiRouter.delete('/admin/rooms/:code', isAdmin, async (req, res) => {
    try {
        const { code } = req.params;
        await Room.deleteOne({ code });
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting room' });
    }
});

// Admin can join any room regardless of capacity
apiRouter.post('/admin/rooms/:code/join', isAdmin, async (req, res) => {
    try {
        const { code } = req.params;
        const { username } = req.body;

        const room = await Room.findOne({ code });
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        if (!room.players.some(p => p.username === username)) {
            room.players.push({ username, ready: false });
            await room.save();
        }

        res.json({ message: 'Joined room successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error joining room' });
    }
});

// Add new route for starting game
apiRouter.post('/rooms/:code/start', async (req, res) => {
    try {
        const room = await Room.findOne({ code: req.params.code });
        if (!room) return res.status(404).json({ message: 'Room not found' });

        room.assignRoles(); // Assign roles before starting
        room.isStarted = true;
        room.phase = 2;
        await room.save();

        res.json({ message: 'Game started', room });
    } catch (error) {
        res.status(500).json({ message: 'Error starting game' });
    }
});

// Add new admin route for force starting any game
apiRouter.post('/admin/rooms/:code/start', isAdmin, async (req, res) => {
    try {
        const { code } = req.params;
        const room = await Room.findOne({ code });
        
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Admin can start game regardless of conditions
        room.isStarted = true;
        room.phase = 2; // Move to Challenge phase
        await room.save();

        res.json({ message: 'Game force started by admin' });
    } catch (error) {
        console.error('Error force starting game:', error);
        res.status(500).json({ message: 'Error starting game' });
    }
});

// Add new admin route for stopping games
apiRouter.post('/admin/rooms/:code/stop', isAdmin, async (req, res) => {
    try {
        const { code } = req.params;
        const room = await Room.findOne({ code });
        
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Reset game state
        room.isStarted = false;
        room.phase = 1;
        room.startTimer = null;
        // Reset player states
        room.players.forEach(player => {
            player.health = 100;
            player.ready = false;
            player.challenges = [];
        });

        await room.save();
        res.json({ 
            message: 'Game stopped by admin',
            room
        });
    } catch (error) {
        console.error('Error stopping game:', error);
        res.status(500).json({ message: 'Error stopping game' });
    }
});

// Add user settings routes
apiRouter.put('/users/settings', async (req, res) => {
    try {
        const { username, newUsername, email, currentPassword, newPassword } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        if (currentPassword) {
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
        }

        // Check if new username is taken
        if (newUsername && newUsername !== username) {
            const existingUser = await User.findOne({ username: newUsername });
            if (existingUser) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
            user.username = newUsername;
        }

        // Update email if provided
        if (email) {
            const existingEmail = await User.findOne({ email, username: { $ne: username } });
            if (existingEmail) {
                return res.status(400).json({ message: 'Email is already in use' });
            }
            user.email = email;
        }

        // Update password if provided
        if (newPassword) {
            user.password = await bcrypt.hash(newPassword, 10);
        }

        await user.save();

        res.json({
            message: 'Settings updated successfully',
            user: {
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
});

// Mount the API router
app.use('/api', apiRouter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to generate room code
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Add cleanup for inactive rooms (optional)
async function cleanupInactiveRooms() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    try {
        await Room.deleteMany({
            lastActivity: { $lt: oneHourAgo },
            status: 'waiting'
        });
    } catch (error) {
        console.error('Error cleaning up rooms:', error);
    }
}

// Run cleanup every hour
setInterval(cleanupInactiveRooms, 60 * 60 * 1000);

// Update the server startup code at the bottom of the file
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT)
    .on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Please try these solutions:`);
            console.error('1. Kill the process using the port:');
            console.error(`   lsof -i :${PORT}`);
            console.error(`   kill -9 <PID>`);
            console.error('2. Or use a different port:');
            console.error('   PORT=3001 node server.js');
            process.exit(1);
        } else {
            console.error('Server error:', error);
            process.exit(1);
        }
    })
    .on('listening', () => {
        console.log(`Server running on port ${PORT}`);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

// Add this after your MongoDB connection setup
async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const adminUser = new User({
                username: 'admin',
                email: 'admin@example.com',
                password: hashedPassword,
                isAdmin: true
            });
            await adminUser.save();
            console.log('Admin user created successfully');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

// Add this after your routes but before app.listen
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    // Ensure we're sending a proper JSON response
    if (!res.headersSent) {
        res.status(500).json({ 
            message: 'An unexpected error occurred',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Add health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Add role assignment when starting game
roomSchema.methods.assignRoles = function() {
    // Randomly select one player as challenger
    const players = this.players;
    const challengerIndex = Math.floor(Math.random() * players.length);
    
    players.forEach((player, index) => {
        player.role = index === challengerIndex ? 'challenger' : 'player';
    });
}; 