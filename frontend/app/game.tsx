import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import Canvas from '../components/Canvas';

const { width, height } = Dimensions.get('window');

interface Player {
  sid: string;
  username: string;
  score: number;
  isHost: boolean;
}

interface Message {
  username: string;
  message: string;
  type?: 'system' | 'guess' | 'correct';
}

export default function GameScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { username, roomCode, isHost } = params;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [isDrawer, setIsDrawer] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [canDraw, setCanDraw] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const canvasRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    // Connect to Socket.IO server
    // Use /api path which is properly routed to backend
    const socketUrl = backendUrl.includes('localhost') ? backendUrl : backendUrl;
    const newSocket = io(socketUrl, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'], // Try polling first
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      
      if (isHost === 'true') {
        newSocket.emit('create_room', {
          room_code: roomCode,
          username: username,
        });
      } else {
        newSocket.emit('join_room', {
          room_code: roomCode,
          username: username,
        });
      }
    });

    newSocket.on('connected', (data) => {
      console.log('Received connected event:', data);
    });

    newSocket.on('room_created', (data) => {
      console.log('Room created:', data);
      setPlayers(data.players);
      addSystemMessage(`Room ${roomCode} created!`);
    });

    newSocket.on('room_joined', (data) => {
      console.log('Room joined:', data);
      setPlayers(data.players);
      addSystemMessage(`Joined room ${roomCode}!`);
    });

    newSocket.on('player_joined', (data) => {
      setPlayers(data.players);
      addSystemMessage('A player joined the room');
    });

    newSocket.on('player_left', (data) => {
      setPlayers(data.players);
      addSystemMessage('A player left the room');
    });

    newSocket.on('game_started', () => {
      setGameStarted(true);
      addSystemMessage('Game started! Get ready to draw and guess!');
    });

    newSocket.on('new_round', (data) => {
      console.log('New round:', data);
      setCurrentRound(data.round);
      setCurrentWord(data.word);
      setIsDrawer(data.drawerSid === newSocket.id);
      setCanDraw(data.drawerSid === newSocket.id);
      setTimeLeft(60);
      
      if (canvasRef.current) {
        canvasRef.current.clear();
      }

      if (data.drawer_sid === newSocket.id) {
        addSystemMessage(`Your turn! Draw: ${data.word}`);
      } else {
        addSystemMessage(`${data.drawer} is drawing...`);
      }

      // Start timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    newSocket.on('stroke_drawn', (data) => {
      if (canvasRef.current && !isDrawer) {
        canvasRef.current.drawStroke(data);
      }
    });

    newSocket.on('canvas_cleared', () => {
      if (canvasRef.current) {
        canvasRef.current.clear();
      }
    });

    newSocket.on('correct_guess', (data) => {
      addSystemMessage(`${data.player} guessed correctly! +${data.points} points`, 'correct');
    });

    newSocket.on('guess_result', (data) => {
      if (data.correct) {
        addSystemMessage(`Correct! You earned ${data.points} points!`, 'correct');
      }
    });

    newSocket.on('chat_message', (data) => {
      addMessage(data.username, data.message);
    });

    newSocket.on('round_end', (data) => {
      setPlayers(data.players);
      addSystemMessage(`Round ended! The word was: ${data.word}`, 'system');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    newSocket.on('game_end', (data) => {
      setPlayers(data.players);
      setGameStarted(false);
      const winner = data.players[0];
      addSystemMessage(`Game Over! Winner: ${winner.username} with ${winner.score} points!`, 'system');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    newSocket.on('error', (data) => {
      Alert.alert('Error', data.message);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      newSocket.disconnect();
    };
  }, []);

  const addSystemMessage = (message: string, type: 'system' | 'correct' = 'system') => {
    setMessages((prev) => [...prev, { username: 'System', message, type }]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const addMessage = (username: string, message: string) => {
    setMessages((prev) => [...prev, { username, message, type: 'guess' }]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleStartGame = () => {
    if (socket && isHost === 'true') {
      socket.emit('start_game', { room_code: roomCode });
    }
  };

  const handleSendGuess = () => {
    if (!guessInput.trim() || !socket) return;

    socket.emit('send_guess', {
      room_code: roomCode,
      guess: guessInput.trim(),
    });

    setGuessInput('');
  };

  const handleLeaveRoom = () => {
    Alert.alert('Leave Room', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          if (socket) {
            socket.disconnect();
          }
          router.back();
        },
      },
    ]);
  };

  const handleStrokeSent = (strokeData: any) => {
    if (socket && canDraw) {
      socket.emit('draw_stroke', {
        room_code: roomCode,
        ...strokeData,
      });
    }
  };

  const handleClearCanvas = () => {
    if (socket && canDraw) {
      socket.emit('clear_canvas', { room_code: roomCode });
      if (canvasRef.current) {
        canvasRef.current.clear();
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleLeaveRoom} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View>
            <Text style={styles.roomCode}>Room: {roomCode}</Text>
            {gameStarted && (
              <Text style={styles.roundInfo}>Round {currentRound} • {timeLeft}s</Text>
            )}
          </View>
        </View>
        {!gameStarted && isHost === 'true' && players.length >= 2 && (
          <TouchableOpacity onPress={handleStartGame} style={styles.startButton}>
            <Text style={styles.startButtonText}>Start</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Players List */}
      <View style={styles.playersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {players.map((player, index) => (
            <View key={player.sid} style={styles.playerCard}>
              <View
                style={[
                  styles.playerAvatar,
                  isDrawer && player.sid === socket?.id && styles.drawerAvatar,
                ]}
              >
                <Text style={styles.playerAvatarText}>
                  {player.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.playerName} numberOfLines={1}>
                {player.username}
              </Text>
              <Text style={styles.playerScore}>{player.score}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        {gameStarted ? (
          <>
            {isDrawer && (
              <View style={styles.wordDisplay}>
                <Text style={styles.wordText}>✏️ Draw: {currentWord}</Text>
              </View>
            )}
            {!isDrawer && currentWord && (
              <View style={styles.wordDisplay}>
                <Text style={styles.wordText}>
                  🔍 Word: {currentWord.replace(/./g, '_ ')}
                </Text>
              </View>
            )}
            {isDrawer && (
              <View style={styles.drawingInstructions}>
                <Text style={styles.instructionText}>
                  👆 Touch and drag to draw
                </Text>
              </View>
            )}
            <Canvas
              ref={canvasRef}
              canDraw={canDraw}
              onStrokeSent={handleStrokeSent}
            />
            {canDraw && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearCanvas}
              >
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.waitingContainer}>
            <Ionicons name="people" size={64} color="#cbd5e1" />
            <Text style={styles.waitingText}>
              Waiting for players...
            </Text>
            <Text style={styles.waitingSubtext}>
              {players.length} / 8 players
            </Text>
            {isHost === 'true' && (
              <Text style={styles.waitingSubtext}>
                Need at least 2 players to start
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Chat/Guess Area */}
      {gameStarted && (
        <View style={styles.chatContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageItem,
                  msg.type === 'system' && styles.systemMessage,
                  msg.type === 'correct' && styles.correctMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    msg.type === 'system' && styles.systemMessageText,
                    msg.type === 'correct' && styles.correctMessageText,
                  ]}
                >
                  {msg.type === 'system' || msg.type === 'correct' ? (
                    msg.message
                  ) : (
                    <>
                      <Text style={styles.messageUsername}>{msg.username}: </Text>
                      {msg.message}
                    </>
                  )}
                </Text>
              </View>
            ))}
          </ScrollView>

          {!isDrawer && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.guessInput}
                placeholder="Type your guess..."
                value={guessInput}
                onChangeText={setGuessInput}
                onSubmitEditing={handleSendGuess}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendGuess}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  roundInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  playersContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  playerCard: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  drawerAvatar: {
    backgroundColor: '#fef3c7',
    borderWidth: 3,
    borderColor: '#fbbf24',
  },
  playerAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4f46e5',
  },
  playerName: {
    fontSize: 12,
    color: '#1e293b',
    marginBottom: 2,
  },
  playerScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  wordDisplay: {
    backgroundColor: '#6366f1',
    padding: 12,
    alignItems: 'center',
  },
  wordText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  waitingText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
  },
  waitingSubtext: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
  },
  clearButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  clearButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  chatContainer: {
    height: 200,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
  },
  messageItem: {
    marginBottom: 8,
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
  },
  systemMessage: {
    backgroundColor: '#dbeafe',
  },
  correctMessage: {
    backgroundColor: '#d1fae5',
  },
  messageText: {
    fontSize: 14,
    color: '#1e293b',
  },
  systemMessageText: {
    color: '#1e40af',
    fontStyle: 'italic',
  },
  correctMessageText: {
    color: '#065f46',
    fontWeight: '600',
  },
  messageUsername: {
    fontWeight: '600',
    color: '#6366f1',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  guessInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
