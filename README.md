# Scribble Game - Real-time Multiplayer Drawing Game

A real-time multiplayer drawing and guessing game with **location-based matching** and **code-based rooms**. Available as both a **mobile app (Expo)** and **web app (React)**.

## 🎮 Features

### Core Gameplay
- **Real-time Multiplayer**: Play with 2-8 players simultaneously
- **Drawing Canvas**: Smooth SVG-based drawing with touch/mouse support
- **Turn-based System**: Players take turns drawing while others guess
- **Live Chat**: Real-time messaging for word guessing
- **Smart Scoring**: Points based on correct guesses and speed (50-200 points)
- **Multiple Rounds**: Configurable rounds (default: 3)
- **Instant Round Progression**: Moves to next round when all players guess correctly
- **60+ Word Bank**: Diverse vocabulary for drawing prompts

### 🌍 Location-Based Matching
- **Find Nearby Players**: Automatically match with players within 50km
- **GPS Integration**: Uses device location to find opponents nearby
- **Smart Matching Algorithm**: Connects closest available players
- **Distance Display**: Shows how far your opponent is
- **Real-time Search**: Instant matching when players are found

### 🔑 Code-Based Rooms
- **Create Room**: Generate a unique 6-character room code
- **Join Room**: Enter a code to join friend's game
- **Join Mid-Game**: Players can join games already in progress
- **Private Sessions**: Play with specific friends using codes

## 🚀 Tech Stack

### Frontend Options

#### Option 1: Web Application (React + TypeScript)
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Routing**: React Router DOM
- **Real-time**: Socket.IO Client
- **Location**: Browser Geolocation API
- **Drawing**: SVG with HTML5 Canvas
- **Styling**: CSS Modules
- **Build Tool**: Vite (fast HMR)

#### Option 2: Mobile Application (Expo + React Native)
- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Real-time**: Socket.IO Client
- **Location**: expo-location for GPS
- **Drawing**: react-native-svg for vector graphics
- **Styling**: React Native StyleSheet
- **Platform**: iOS & Android (deployable to Play Store/App Store)

### Backend (Shared)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.IO (WebSocket + polling)
- **Database**: MongoDB with Mongoose
- **Geolocation**: geolib (Haversine distance calculation)
- **CORS**: Enabled for cross-origin requests

## 📂 Project Structure

```
/app
├── backend/                    # Node.js + Express + Socket.IO
│   ├── server.js              # Main server file
│   ├── package.json
│   └── .env
│
├── web-frontend/              # React Web App (NEW!)
│   ├── src/
│   │   ├── main.tsx          # Entry point
│   │   ├── App.tsx           # Router setup
│   │   ├── pages/
│   │   │   ├── HomePage.tsx  # Home screen
│   │   │   └── GamePage.tsx  # Game screen
│   │   ├── components/
│   │   │   └── Canvas.tsx    # Drawing canvas
│   │   └── styles/           # CSS files
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
│
└── frontend/                  # Expo Mobile App (Original)
    ├── app/
    │   ├── index.tsx         # Home screen
    │   └── game.tsx          # Game screen
    ├── components/
    │   └── Canvas.tsx        # Drawing canvas
    ├── app.json
    └── package.json
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally or remote connection
- Git (optional)

### 1. Clone Repository
```bash
git clone <repository-url>
cd app
```

### 2. Setup Backend
```bash
cd backend
npm install

# Create .env file
echo "MONGO_URL=mongodb://localhost:27017/scribble_game" > .env
echo "PORT=8001" >> .env

# Start backend
npm start
```

Backend runs on: `http://localhost:8001`

### 3. Setup Web Frontend (React)

```bash
cd ../web-frontend
yarn install

# Create .env file
echo "VITE_BACKEND_URL=http://localhost:8001" > .env

# Start development server
yarn dev
```

Web app runs on: `http://localhost:3000`

### 4. Setup Mobile Frontend (Expo) - Optional

```bash
cd ../frontend
yarn install

# Start Expo dev server
yarn start
```

Expo dev server runs on: `http://localhost:3000` (if web-frontend not running)

## 🌐 Running the Web Application

### Development Mode
```bash
cd web-frontend
yarn dev
```

### Production Build
```bash
cd web-frontend
yarn build
yarn preview
```

### Deploy to Production
Build output is in `dist/` folder. Deploy to:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop `dist` folder
- **GitHub Pages**: Configure in repository settings
- **Any static host**: Upload `dist` folder contents

## 📱 Running the Mobile Application

### Development
```bash
cd frontend
yarn start
```

Then:
- Press `w` for web
- Scan QR code with Expo Go app for mobile testing

### Build for App Stores

**Android (Google Play):**
```bash
cd frontend
eas build --platform android --profile production
```

**iOS (App Store):**
```bash
cd frontend
eas build --platform ios --profile production
```

See [Play Store Deployment Guide](#play-store-deployment) below for details.

## 🎯 How to Play

### Web Version
1. Open browser to `http://localhost:3000`
2. Enter username
3. Choose:
   - **Find Nearby Players**: Match with players within 50km
   - **Create Room**: Get a 6-digit code to share
   - **Join with Code**: Enter friend's code

### Gameplay
- One player draws the secret word
- Other players guess by typing in chat
- Correct guesses earn points (faster = more points)
- Each round lasts 60 seconds
- Players rotate drawing duties
- Highest score wins!

## 🔌 Socket.IO Events

### Client → Server
| Event | Purpose | Data |
|-------|---------|------|
| `update_location` | Update player GPS coordinates | `{lat, lng, username}` |
| `find_nearby_match` | Search for nearby players | `{lat, lng, username}` |
| `cancel_search` | Cancel nearby search | - |
| `create_room` | Create game room with code | `{room_code, username}` |
| `join_room` | Join existing room | `{room_code, username}` |
| `start_game` | Start the game (host only) | `{room_code}` |
| `draw_stroke` | Send drawing strokes | `{room_code, points, color, width}` |
| `clear_canvas` | Clear drawing canvas | `{room_code}` |
| `send_guess` | Submit word guess | `{room_code, guess}` |

### Server → Client
| Event | Purpose | Data |
|-------|---------|------|
| `connected` | Connection confirmed | `{sid}` |
| `searching` | Searching for nearby players | `{message}` |
| `match_found` | Nearby match found | `{roomCode, matchedWith, distance, players}` |
| `room_created` | Room successfully created | `{room_code, players}` |
| `room_joined` | Successfully joined room | `{room_code, players}` |
| `player_joined` | Another player joined | `{players}` |
| `player_left` | Player left the room | `{players}` |
| `game_started` | Game has begun | - |
| `new_round` | New round started | `{round, drawer, drawerSid, word, wordLength}` |
| `stroke_drawn` | Drawing stroke from drawer | `{points, color, width}` |
| `canvas_cleared` | Canvas was cleared | - |
| `correct_guess` | Player guessed correctly | `{player, points}` |
| `guess_result` | Your guess result | `{correct, points?}` |
| `chat_message` | Chat message | `{username, message}` |
| `round_end` | Round ended | `{word, players}` |
| `game_end` | Game finished | `{players}` |

## ⚙️ Configuration

### Backend (`server.js`)
```javascript
const NEARBY_RADIUS_KM = 50;           // Match radius in kilometers
const MAX_PLAYERS = 8;                  // Players per room
const MAX_ROUNDS = 3;                   // Number of rounds
const ROUND_DURATION = 60000;           // 60 seconds per round
```

### Word Bank
Located in `backend/server.js` - add/remove words:
```javascript
const WORD_BANK = ['cat', 'dog', 'house', ...];
```

## 🚀 Deployment

### Web Application

**Option 1: Vercel (Recommended)**
```bash
cd web-frontend
npm install -g vercel
vercel
```

**Option 2: Netlify**
```bash
# Build
cd web-frontend
yarn build

# Deploy dist/ folder via Netlify CLI or web interface
```

**Option 3: Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY web-frontend/package.json .
RUN yarn install
COPY web-frontend .
RUN yarn build
CMD ["yarn", "preview"]
```

### Backend Deployment

**Deploy to:**
- **Railway**: Connect GitHub repo
- **Render**: Deploy from Git
- **Heroku**: `git push heroku main`
- **DigitalOcean**: App Platform
- **AWS/GCP**: EC2/Compute Engine

**Environment Variables:**
```
MONGO_URL=mongodb+srv://...
PORT=8001
NODE_ENV=production
```

### Mobile App (Play Store)

See detailed guide in previous documentation. Summary:

1. **Setup EAS Build**
   ```bash
   cd frontend
   npm install -g eas-cli
   eas build:configure
   ```

2. **Build AAB**
   ```bash
   eas build --platform android --profile production
   ```

3. **Upload to Play Console**
   - Create app in Play Console
   - Upload AAB file
   - Complete store listing
   - Submit for review

## 🔒 Environment Variables

### Backend (`.env`)
```env
MONGO_URL=mongodb://localhost:27017/scribble_game
PORT=8001
NODE_ENV=development
```

### Web Frontend (`.env`)
```env
VITE_BACKEND_URL=http://localhost:8001
```

### Mobile Frontend (`.env`)
```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
```

## 🧪 Testing

### Backend Testing
```bash
# Test API endpoint
curl http://localhost:8001/api

# Test health check
curl http://localhost:8001/health

# Test Socket.IO connection
# Use browser console or Postman
```

### Frontend Testing
- Open multiple browser tabs/windows
- Test create/join room flow
- Test drawing synchronization
- Test location matching
- Test mobile responsiveness

## 🐛 Troubleshooting

### Web App Issues

**Issue: Backend connection fails**
- Check `VITE_BACKEND_URL` in `.env`
- Ensure backend is running on port 8001
- Check browser console for errors

**Issue: Drawing not synchronizing**
- Open browser console (F12)
- Check for Socket.IO connection logs
- Verify both users are in same room

**Issue: Location not working**
- Grant browser location permissions
- Use HTTPS in production (HTTP blocks geolocation)
- Check browser console for errors

### Mobile App Issues

**Issue: Can't connect to backend**
- Update `EXPO_PUBLIC_BACKEND_URL` in `.env`
- Restart Expo dev server
- Check if backend is accessible from mobile device

**Issue: Touch drawing not working**
- Ensure `touchAction: 'none'` is set
- Check Canvas component implementation
- Test on actual device (not just browser)

## 📊 Performance Tips

### Web App
- Enable production build: `yarn build`
- Use CDN for static assets
- Enable gzip compression
- Implement service worker for offline support

### Backend
- Use MongoDB indexes for queries
- Enable connection pooling
- Implement rate limiting
- Use Redis for session storage (optional)

## 🎨 Customization

### Add New Words
Edit `backend/server.js`:
```javascript
const WORD_BANK = [
  ...existingWords,
  'your', 'new', 'words'
];
```

### Change Theme Colors
Web: Edit `web-frontend/src/styles/*.css`
Mobile: Edit `frontend/app/*.tsx` StyleSheet

### Adjust Game Settings
Edit `backend/server.js`:
- `NEARBY_RADIUS_KM`: Search radius
- `MAX_PLAYERS`: Room capacity
- `MAX_ROUNDS`: Game length
- `ROUND_DURATION`: Time per round

## 📄 License

MIT License - Free to use and modify!

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📞 Support

For issues or questions:
- Open GitHub issue
- Check existing documentation
- Review troubleshooting section

## 🎉 Credits

Built with modern web & mobile technologies:
- React / React Native
- Socket.IO for real-time communication
- Node.js + Express
- MongoDB
- Vite for fast development
- TypeScript for type safety

---

**Made with ❤️ for drawing and guessing enthusiasts!**

## Quick Start Summary

### Web Version (Fastest)
```bash
# Terminal 1 - Backend
cd backend && npm install && npm start

# Terminal 2 - Web Frontend
cd web-frontend && yarn install && yarn dev

# Open browser: http://localhost:3000
```

### Mobile Version
```bash
# Terminal 1 - Backend
cd backend && npm install && npm start

# Terminal 2 - Mobile Frontend
cd frontend && yarn install && yarn start

# Scan QR code with Expo Go app
```

That's it! Start drawing and guessing! 🎨
