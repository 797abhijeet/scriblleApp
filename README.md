# Scribble Game - Real-time Multiplayer Drawing Game

A real-time multiplayer drawing and guessing game built with **React**, **TypeScript**, **Node.js**, and **Socket.IO**. Features location-based matching and code-based rooms for web browsers.

## 🎮 Features

- **Real-time Multiplayer**: Play with 2-8 players simultaneously  
- **Drawing Canvas**: Smooth HTML5 Canvas drawing with mouse support
- **Turn-based Gameplay**: Players rotate drawing duties
- **Live Chat**: Real-time messaging for word guessing
- **Smart Scoring**: 50-200 points based on speed and accuracy
- **Instant Round Progression**: Moves to next word when everyone guesses
- **Location-Based Matching**: Find nearby players within 50km using GPS
- **Code-Based Rooms**: Create/join private games with 6-digit codes
- **Mid-Game Joining**: Players can join games already in progress
- **60+ Word Bank**: Diverse vocabulary for drawing prompts

## 🚀 Tech Stack

### Frontend (Web)
- **React 18** with **TypeScript**
- **Vite** - Lightning-fast build tool
- **React Router DOM** - Client-side routing
- **Socket.IO Client** - Real-time bidirectional communication
- **HTML5 Canvas** - Drawing with normalized coordinates
- **CSS3** - Modern styling with flexbox/grid
- **Browser Geolocation API** - GPS location matching

### Backend
- **Node.js** + **Express.js** - RESTful API server
- **Socket.IO** - WebSocket + polling for real-time features
- **MongoDB** + **Mongoose** - Database and ODM
- **geolib** - Haversine distance calculations for location matching

## 📂 Clean Project Structure

```
/app
├── backend/                    # Node.js + Express Server
│   ├── server.js              # Main server file with Socket.IO
│   ├── package.json
│   ├── yarn.lock
│   └── .env
│
├── frontend/                   # React Web App
│   ├── src/
│   │   ├── main.tsx          # Entry point
│   │   ├── App.tsx           # Router configuration
│   │   ├── pages/
│   │   │   ├── HomePage.tsx  # Home screen (create/join/nearby)
│   │   │   └── GamePage.tsx  # Game screen (canvas + chat)
│   │   ├── components/
│   │   │   └── Canvas.tsx    # HTML5 Canvas drawing component
│   │   └── styles/
│   │       ├── global.css
│   │       ├── App.css
│   │       ├── HomePage.css
│   │       ├── GamePage.css
│   │       └── Canvas.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── .env
│
└── README.md                   # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js 18+** installed
- **MongoDB** running (local or remote)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd app
```

### 2. Setup Backend
```bash
cd backend
yarn install

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017/scribble_game
PORT=8001
NODE_ENV=development
EOF

# Start server
yarn start
# OR
node server.js
```

Backend runs at: **http://localhost:8001**

### 3. Setup Frontend
```bash
cd ../frontend
yarn install

# Create .env file  
cat > .env << EOF
VITE_BACKEND_URL=http://localhost:8001
EOF

# Start development server
yarn dev
```

Frontend runs at: **http://localhost:3000**

## 🎯 How to Play

### Getting Started
1. Open **http://localhost:3000** in your browser
2. Enter your username
3. Choose one of three options:

### Option 1: Find Nearby Players 📍
- Click "Find Nearby Players"
- Grant location permission
- Automatically matches with players within 50km
- Get notified when match is found

### Option 2: Create Room ➕
- Click "Create Room"
- Get a unique 6-digit code
- Share code with friends
- Wait for players to join
- Start game when ready (2+ players)

### Option 3: Join with Code 🚪
- Click "Join with Code"
- Enter friend's 6-digit room code
- Join instantly

### Gameplay
1. **Drawing Turn**: One player draws the secret word shown only to them
2. **Guessing**: Other players type guesses in the chat
3. **Scoring**: Correct guesses earn 50-200 points (faster = more points)
4. **Rotation**: After 60 seconds or when everyone guesses, next player draws
5. **Winner**: Highest score after all rounds wins!

## 🌐 API & Socket.IO Events

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | API health check |
| GET | `/api/rooms` | List all active rooms |
| GET | `/api/location/searching` | Players searching for nearby match |
| GET | `/health` | Server health + MongoDB status |

### Socket.IO Events

**Client → Server**
```typescript
// Location matching
socket.emit('find_nearby_match', { lat, lng, username })
socket.emit('cancel_search')

// Room management
socket.emit('create_room', { room_code, username })
socket.emit('join_room', { room_code, username })
socket.emit('start_game', { room_code })

// Gameplay
socket.emit('draw_stroke', { room_code, points, color, width })
socket.emit('clear_canvas', { room_code })
socket.emit('send_guess', { room_code, guess })
```

**Server → Client**
```typescript
// Connection
socket.on('connected', ({ sid }) => {})

// Location matching
socket.on('searching', ({ message }) => {})
socket.on('match_found', ({ roomCode, matchedWith, distance }) => {})

// Room events
socket.on('room_created', ({ room_code, players }) => {})
socket.on('room_joined', ({ room_code, players }) => {})
socket.on('player_joined', ({ players }) => {})
socket.on('player_left', ({ players }) => {})

// Game events
socket.on('game_started', () => {})
socket.on('new_round', ({ round, drawer, word, wordLength }) => {})
socket.on('stroke_drawn', ({ points, color, width }) => {})
socket.on('canvas_cleared', () => {})
socket.on('correct_guess', ({ player, points }) => {})
socket.on('round_end', ({ word, players }) => {})
socket.on('game_end', ({ players }) => {})

// Chat
socket.on('chat_message', ({ username, message }) => {})
socket.on('guess_result', ({ correct, points? }) => {})
```

## ⚙️ Configuration

### Game Settings (backend/server.js)
```javascript
const NEARBY_RADIUS_KM = 50;    // Location match radius
const MAX_PLAYERS = 8;          // Players per room
const MAX_ROUNDS = 3;           // Number of rounds
const ROUND_DURATION = 60000;   // 60 seconds per round
```

### Word Bank (backend/server.js)
```javascript
const WORD_BANK = [
  'cat', 'dog', 'house', 'tree', 'car', ...
  // Add your own words here!
];
```

## 🚀 Deployment

### Frontend Deployment

**Option 1: Vercel (Recommended)**
```bash
cd frontend
npm install -g vercel
vercel
```

**Option 2: Netlify**
```bash
cd frontend
yarn build
# Upload dist/ folder to Netlify
```

**Option 3: GitHub Pages**
```bash
cd frontend
yarn build
# Configure vite.config.ts with base: '/repo-name/'
# Push dist/ to gh-pages branch
```

### Backend Deployment

**Railway.app** (Easiest)
1. Connect GitHub repository
2. Select `/app/backend` as root directory
3. Add environment variables (MONGO_URL, PORT)
4. Deploy automatically

**Render.com**
1. Create new Web Service
2. Connect repository
3. Set build command: `cd backend && yarn install`
4. Set start command: `node server.js`
5. Add environment variables

**Heroku**
```bash
cd backend
heroku create scribble-game-api
git push heroku main
heroku config:set MONGO_URL=<your-mongo-url>
```

### Environment Variables for Production

**Frontend**
```env
VITE_BACKEND_URL=https://your-backend-api.com
```

**Backend**
```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/scribble
PORT=8001
NODE_ENV=production
```

## 🧪 Testing

### Local Testing
```bash
# Terminal 1 - Backend
cd backend && yarn start

# Terminal 2 - Frontend  
cd frontend && yarn dev

# Open multiple browser tabs to test multiplayer
```

### Test Scenarios
1. **Create & Join**: Create room in Tab 1, join in Tab 2
2. **Drawing Sync**: Draw in Tab 1, verify appears in Tab 2
3. **Guessing**: Type correct word, verify points awarded
4. **Location**: Test nearby matching with two devices in same location
5. **Mid-Game Join**: Join game in progress, verify sees current round

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check MongoDB is running
mongod --version

# Check port 8001 is available
lsof -i :8001

# View backend logs
cd backend && yarn start
```

### Frontend Won't Connect to Backend
- Verify `VITE_BACKEND_URL` in frontend/.env
- Check backend is running: `curl http://localhost:8001/api`
- Check browser console for errors (F12)
- Ensure CORS is enabled in backend

### Drawing Not Synchronizing
- Open browser console (F12) and check for Socket.IO errors
- Verify both players are in the same room
- Check network tab for Socket.IO connections
- Ensure firewall allows WebSocket connections

### Location Matching Not Working
- Grant browser location permissions
- Use HTTPS in production (HTTP blocks geolocation on most browsers)
- Check both users are within 50km
- Verify backend location matching logic

## 📈 Performance Tips

### Frontend Optimization
```bash
# Production build
cd frontend
yarn build

# Preview production build
yarn preview
```

- Minified JavaScript and CSS
- Tree-shaken unused code
- Optimized assets
- Gzip compression ready

### Backend Optimization
- Use MongoDB indexes for faster queries
- Enable connection pooling
- Implement rate limiting for API endpoints
- Use Redis for session storage (optional)
- Enable gzip compression in Express

## 🎨 Customization

### Adding New Words
Edit `backend/server.js`:
```javascript
const WORD_BANK = [
  ...existingWords,
  'spaceship', 'dinosaur', 'rainbow' // Add here
];
```

### Changing Colors/Theme
Edit `frontend/src/styles/*.css`:
```css
/* Primary color */
.primary-button {
  background-color: #your-color;
}
```

### Adjusting Game Rules
Edit `backend/server.js`:
```javascript
const MAX_ROUNDS = 5;           // More rounds
const ROUND_DURATION = 90000;   // 90 second rounds
const NEARBY_RADIUS_KM = 100;   // Wider search radius
```

## 📄 License

MIT License - Free to use and modify!

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: Open a GitHub issue
- **Questions**: Check this README first
- **Bugs**: Provide steps to reproduce

## 🎉 Credits

Built with modern web technologies:
- React + TypeScript
- Socket.IO for real-time features
- Node.js + Express
- MongoDB
- Vite for blazing-fast development

---

## Quick Start (TL;DR)

```bash
# Backend
cd backend && yarn install && yarn start

# Frontend (new terminal)
cd frontend && yarn install && yarn dev

# Open http://localhost:3000
```

**Made with ❤️ for drawing enthusiasts!**
