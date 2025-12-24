# Scribble Game - Mobile App

A real-time multiplayer drawing and guessing game with **location-based matching** and **code-based rooms**. Built with Expo (React Native), Node.js, Express, Socket.IO, and MongoDB.

## 🎮 Features

### Core Gameplay
- **Real-time Multiplayer**: Play with 2-8 players simultaneously
- **Drawing Canvas**: Smooth SVG-based drawing with touch support
- **Turn-based System**: Players take turns drawing while others guess
- **Live Chat**: Real-time messaging for word guessing
- **Smart Scoring**: Points based on correct guesses and speed (50-200 points)
- **Multiple Rounds**: Configurable rounds (default: 3)
- **60+ Word Bank**: Diverse vocabulary for drawing prompts

### 🌍 Location-Based Matching (NEW!)
- **Find Nearby Players**: Automatically match with players within 50km
- **GPS Integration**: Uses device location to find opponents nearby
- **Smart Matching Algorithm**: Connects closest available players
- **Distance Display**: Shows how far your opponent is
- **Real-time Search**: Instant matching when players are found

### 🔑 Code-Based Rooms
- **Create Room**: Generate a unique 6-character room code
- **Join Room**: Enter a code to join friend's game
- **Private Sessions**: Play with specific friends using codes

## 📱 How to Play

### Option 1: Find Nearby Players
1. Open the app and enter your username
2. Tap **"Find Nearby Players"**
3. Grant location permission
4. Wait for nearby match (within 50km)
5. Get matched and start playing!

### Option 2: Create/Join with Code
1. Enter your username
2. **Create Room**: Generate a code and share with friends
3. **Join Room**: Enter friend's code to join
4. Host starts the game when ready

### Gameplay
- One player draws the secret word
- Other players guess by typing in chat
- Correct guesses earn points (faster = more points)
- Each round lasts 60 seconds
- Players rotate drawing duties
- Highest score wins!

## 🛠️ Technical Stack

### Frontend (Mobile App)
- **Framework**: Expo (React Native 0.79+)
- **Navigation**: Expo Router (file-based routing)
- **Real-time**: Socket.IO Client
- **Location**: expo-location for GPS
- **Drawing**: react-native-svg for vector graphics
- **Language**: TypeScript
- **UI**: Native React Native components

### Backend (API Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.IO (WebSocket + polling)
- **Database**: MongoDB with Mongoose
- **Geolocation**: geolib (Haversine distance calculation)
- **CORS**: Enabled for cross-origin requests

### Database Schema
```javascript
// Game Room
{
  roomCode: String,
  players: [{
    sid: String,
    username: String,
    score: Number,
    isHost: Boolean
  }],
  gameStarted: Boolean,
  currentRound: Number,
  maxRounds: Number,
  currentDrawerSid: String,
  currentWord: String,
  strokes: Array,
  guessedPlayers: Array
}

// Player Location (in-memory)
{
  socketId: String,
  lat: Number,
  lng: Number,
  username: String,
  timestamp: Number
}
```

## 🌐 Socket.IO Events

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

## 📍 Location Matching Algorithm

```javascript
// 1. User initiates nearby search with GPS coordinates
find_nearby_match({lat, lng, username})

// 2. Server calculates distance to all searching players
distance = haversine(lat1, lng1, lat2, lng2)

// 3. If player found within 50km radius:
//    - Create room automatically
//    - Join both players
//    - Notify both with distance

// 4. If no match:
//    - Add to search queue
//    - Wait for another player
```

## 🚀 Deployment

### Google Play Store
1. Configure `app.json`:
   ```json
   {
     "android": {
       "package": "com.yourcompany.scribble",
       "permissions": [
         "ACCESS_COARSE_LOCATION",
         "ACCESS_FINE_LOCATION"
       ]
     }
   }
   ```

2. Build APK/AAB:
   ```bash
   eas build --platform android --profile production
   ```

3. Submit to Play Store:
   - Create Play Console account ($25)
   - Upload AAB file
   - Configure store listing
   - Set location permissions rationale
   - Submit for review

### Backend Deployment
- Deploy Node.js server to any cloud platform
- Requires: Node.js 18+, MongoDB instance
- Environment variables:
  ```
  MONGO_URL=mongodb://...
  PORT=8001
  ```

## 🔒 Permissions

### Android (app.json)
```json
{
  "android": {
    "permissions": [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "INTERNET"
    ]
  }
}
```

### iOS (Info.plist - auto-generated)
- `NSLocationWhenInUseUsageDescription`: "Find nearby players for multiplayer games"

## ⚙️ Configuration

### Backend (`server.js`)
```javascript
const NEARBY_RADIUS_KM = 50;           // Match radius in kilometers
const LOCATION_UPDATE_INTERVAL = 30000; // 30 seconds
const MAX_PLAYERS = 8;                  // Players per room
const MAX_ROUNDS = 3;                   // Number of rounds
const ROUND_DURATION = 60000;           // 60 seconds per round
```

### Word Bank
Located in `server.js` - add/remove words as needed:
```javascript
const WORD_BANK = ['cat', 'dog', 'house', ...];
```

## 🧪 Testing

### Test Location Matching
To test nearby matching on same device:
1. Open two browser tabs or use two phones
2. Both users: "Find Nearby Players"
3. Grant location permissions
4. Should match automatically if within 50km

### Test Code-Based Rooms
1. User 1: Create room → Get code (e.g., "ABC123")
2. User 2: Join room → Enter "ABC123"
3. User 1: Start game
4. Play!

## 📦 Project Structure

```
/app
├── frontend/                 # Expo React Native app
│   ├── app/
│   │   ├── index.tsx        # Home screen (location/code matching)
│   │   └── game.tsx         # Game screen (canvas, chat, scores)
│   ├── components/
│   │   └── Canvas.tsx       # Drawing canvas component
│   ├── app.json             # Expo configuration
│   └── package.json
├── backend/                 # Node.js Express server
│   ├── server.js           # Main server file
│   ├── package.json
│   └── .env
└── README.md
```

## 🐛 Troubleshooting

### Location Not Working
- Ensure location permissions granted
- Check GPS is enabled on device
- Try in outdoor area for better signal

### No Nearby Players Found
- Increase search radius in `server.js`
- Test with multiple devices in same location
- Check both devices have location enabled

### Socket Connection Failed
- Verify backend server is running
- Check `EXPO_PUBLIC_BACKEND_URL` in `.env`
- Ensure firewall allows WebSocket connections

## 🎯 Future Enhancements

- [ ] AI opponent for solo play
- [ ] Custom word lists and categories
- [ ] Color picker and brush sizes
- [ ] Drawing tools (shapes, fill, eraser)
- [ ] Achievements and statistics
- [ ] Global leaderboards
- [ ] Voice chat during gameplay
- [ ] Replay drawing animations
- [ ] Tournament mode
- [ ] Custom room settings (time, rounds, radius)

## 📄 License

MIT License - Free to use and modify!

## 👨‍💻 Credits

Built with ❤️ using modern web & mobile technologies.

---

**Tech Stack Summary:**
- 📱 Expo + React Native + TypeScript
- 🔌 Socket.IO (Real-time bidirectional communication)
- 🌐 Node.js + Express.js
- 🗄️ MongoDB
- 📍 GPS Location Services (expo-location)
- 🎨 SVG Drawing (react-native-svg)
