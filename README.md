# Scribble Game

A real-time multiplayer drawing and guessing game built with Expo (React Native), FastAPI, and Socket.IO.

## Features

- **Real-time Multiplayer**: Play with 2-8 players in the same room
- **Drawing Canvas**: Smooth touch-based drawing with SVG rendering
- **Turn-based Gameplay**: Players take turns drawing while others guess
- **Live Chat**: Real-time messaging for guessing words
- **Scoring System**: Points awarded based on correct guesses and speed
- **Room System**: Create or join rooms with unique codes
- **Multiple Rounds**: Configurable number of rounds (default: 3)
- **Word Bank**: 60+ words to draw from

## How to Play

1. **Create or Join Room**
   - Enter your username
   - Create a new room (generates a 6-character code) OR join an existing room with a code

2. **Start Game**
   - Room host can start the game when at least 2 players have joined
   - Maximum 8 players per room

3. **Gameplay**
   - One player is chosen to draw a word (shown only to them)
   - Other players try to guess the word by typing in the chat
   - Correct guesses earn points (more points for faster guesses)
   - Each round lasts 60 seconds
   - Players take turns being the drawer

4. **Scoring**
   - Guessers: 50-200 points based on speed of correct guess
   - Drawer: 50 points if at least one player guesses correctly

5. **Winning**
   - After all rounds are complete, the player with the highest score wins!

## Technical Stack

### Frontend (Expo - React Native)
- **Framework**: Expo Router for navigation
- **Real-time**: Socket.IO client for bidirectional communication
- **Drawing**: react-native-svg for vector-based drawing
- **State Management**: React hooks
- **UI**: Native React Native components

### Backend (FastAPI + Python)
- **Framework**: FastAPI for REST API
- **Real-time**: python-socketio for WebSocket connections
- **Database**: MongoDB for persistent storage (optional)
- **Game Logic**: In-memory room management

## Play Store Deployment

To deploy this app to the Google Play Store:

1. **Build APK/AAB**
   ```bash
   cd /app/frontend
   eas build --platform android
   ```

2. **Requirements**
   - Google Play Developer account ($25 one-time fee)
   - App signing key
   - Privacy policy URL
   - Store listing assets (screenshots, descriptions)

3. **Configure app.json**
   - Update `android.package` to your unique package name
   - Set proper app name and descriptions
   - Configure permissions

4. **Submit to Play Store**
   - Upload AAB file to Google Play Console
   - Complete store listing
   - Set content rating
   - Submit for review

## Game Configuration

You can customize these settings in `server.py`:

- `max_players`: Maximum players per room (default: 8)
- `max_rounds`: Number of rounds (default: 3)
- `WORD_BANK`: List of words to draw
- Round timer: 60 seconds (can be modified in `round_timer` function)

## License

MIT License - Feel free to use and modify!

## Credits

Made with ❤️ for Scribble lovers!
