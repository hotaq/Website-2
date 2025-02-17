#!/bin/bash
echo "Stopping existing server..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || echo "No server running on port 3000"
echo "Starting server..."
node server.js 