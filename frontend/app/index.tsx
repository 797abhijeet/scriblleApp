import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

export default function HomeScreen() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'nearby'>('menu');
  const [searchingNearby, setSearchingNearby] = useState(false);
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    // Request location permission on mount
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude
        });
      }
    })();
  }, []);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    const code = generateRoomCode();
    router.push({
      pathname: '/game',
      params: { username, roomCode: code, isHost: 'true' },
    });
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }
    router.push({
      pathname: '/game',
      params: { username, roomCode: roomCode.toUpperCase(), isHost: 'false' },
    });
  };

  const handleFindNearby = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    // Check location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Required',
        'Please enable location access to find nearby players',
        [{ text: 'OK' }]
      );
      return;
    }

    setSearchingNearby(true);

    // Get current location
    const loc = await Location.getCurrentPositionAsync({});
    const userLocation = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude
    };
    setLocation(userLocation);

    // Connect to Socket.IO
    const socketUrl = backendUrl.replace('/api', '');
    const newSocket = io(socketUrl.includes('localhost') ? socketUrl : `${backendUrl}/api`, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server for nearby search');
      
      // Send location and search for nearby players
      newSocket.emit('find_nearby_match', {
        lat: userLocation.lat,
        lng: userLocation.lng,
        username: username
      });
    });

    newSocket.on('searching', (data) => {
      console.log('Searching for nearby players:', data.message);
    });

    newSocket.on('match_found', (data) => {
      console.log('Match found!', data);
      setSearchingNearby(false);
      
      Alert.alert(
        'Match Found!',
        `Matched with ${data.matchedWith} (${data.distance}km away)`,
        [
          {
            text: 'Join Game',
            onPress: () => {
              newSocket.disconnect();
              router.push({
                pathname: '/game',
                params: { 
                  username, 
                  roomCode: data.roomCode, 
                  isHost: 'false',
                  matchType: 'nearby'
                },
              });
            }
          }
        ]
      );
    });

    newSocket.on('error', (data) => {
      setSearchingNearby(false);
      Alert.alert('Error', data.message);
      newSocket.disconnect();
    });

    setSocket(newSocket);
  };

  const handleCancelSearch = () => {
    if (socket) {
      socket.emit('cancel_search');
      socket.disconnect();
      setSocket(null);
    }
    setSearchingNearby(false);
    setMode('menu');
  };

  if (searchingNearby) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.searchingContainer}>
            <Ionicons name="location" size={80} color="#6366f1" />
            <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
            <Text style={styles.searchingText}>Finding Nearby Players...</Text>
            <Text style={styles.searchingSubtext}>
              Searching within 50km radius
            </Text>
            {location && (
              <Text style={styles.locationText}>
                📍 Your location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </Text>
            )}
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSearch}
            >
              <Text style={styles.cancelButtonText}>Cancel Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="brush" size={80} color="#6366f1" />
            <Text style={styles.title}>Scribble</Text>
            <Text style={styles.subtitle}>Draw, Guess & Have Fun!</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setMode('nearby')}
            >
              <Ionicons name="location" size={24} color="white" />
              <Text style={styles.primaryButtonText}>Find Nearby Players</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setMode('create')}
            >
              <Ionicons name="add-circle-outline" size={24} color="#6366f1" />
              <Text style={styles.secondaryButtonText}>Create Room</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setMode('join')}
            >
              <Ionicons name="enter-outline" size={24} color="#6366f1" />
              <Text style={styles.secondaryButtonText}>Join with Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Made with ❤️ for Scribble lovers</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('menu')}
          >
            <Ionicons name="arrow-back" size={24} color="#6366f1" />
          </TouchableOpacity>

          <View style={styles.formHeader}>
            <Ionicons
              name={mode === 'create' ? 'add-circle' : mode === 'nearby' ? 'location' : 'enter'}
              size={60}
              color="#6366f1"
            />
            <Text style={styles.formTitle}>
              {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Nearby' : 'Join Room'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                maxLength={20}
                autoCapitalize="words"
              />
            </View>

            {mode === 'join' && (
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter room code"
                  value={roomCode}
                  onChangeText={(text) => setRoomCode(text.toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {mode === 'nearby' && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={24} color="#6366f1" />
                <Text style={styles.infoText}>
                  We'll find players near you (within 50km) who are also looking for a game!
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={
                mode === 'create' 
                  ? handleCreateRoom 
                  : mode === 'nearby' 
                  ? handleFindNearby 
                  : handleJoinRoom
              }
            >
              <Text style={styles.primaryButtonText}>
                {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Match' : 'Join Room'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 8,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  secondaryButtonText: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  formTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#1e293b',
  },
  infoBox: {
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 14,
    lineHeight: 20,
  },
  searchingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  searchingText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  searchingSubtext: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 32,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
