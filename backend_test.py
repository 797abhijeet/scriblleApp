#!/usr/bin/env python3
"""
Comprehensive Backend Test Suite for Scribble Game
Tests API endpoints and Socket.IO functionality
"""

import asyncio
import aiohttp
import socketio
import json
import time
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Backend URL from environment
BACKEND_URL = "https://scribbly-draw.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"
SOCKET_URL = BACKEND_URL

class TestResults:
    def __init__(self):
        self.results = {}
        self.errors = []
    
    def add_result(self, test_name: str, success: bool, message: str = ""):
        self.results[test_name] = {
            "success": success,
            "message": message,
            "timestamp": time.time()
        }
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status}: {test_name} - {message}")
    
    def add_error(self, test_name: str, error: str):
        self.errors.append(f"{test_name}: {error}")
        logger.error(f"ERROR in {test_name}: {error}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("SCRIBBLE GAME BACKEND TEST RESULTS")
        print("="*80)
        
        passed = sum(1 for r in self.results.values() if r["success"])
        total = len(self.results)
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        print("\n📋 API ENDPOINT TESTS:")
        for test_name, result in self.results.items():
            if "API" in test_name:
                status = "✅" if result["success"] else "❌"
                print(f"  {status} {test_name}: {result['message']}")
        
        print("\n🔌 SOCKET.IO TESTS:")
        for test_name, result in self.results.items():
            if "Socket" in test_name:
                status = "✅" if result["success"] else "❌"
                print(f"  {status} {test_name}: {result['message']}")
        
        if self.errors:
            print("\n🚨 CRITICAL ERRORS:")
            for error in self.errors:
                print(f"  ❌ {error}")
        
        print("\n" + "="*80)

class SocketIOTestClient:
    def __init__(self, client_id: str):
        self.client_id = client_id
        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self.events_received = []
        self.connected = False
        
        # Register event handlers
        self.sio.on('connect', self._on_connect)
        self.sio.on('disconnect', self._on_disconnect)
        self.sio.on('connected', self._on_connected)
        self.sio.on('room_created', self._on_room_created)
        self.sio.on('room_joined', self._on_room_joined)
        self.sio.on('player_joined', self._on_player_joined)
        self.sio.on('game_started', self._on_game_started)
        self.sio.on('new_round', self._on_new_round)
        self.sio.on('stroke_drawn', self._on_stroke_drawn)
        self.sio.on('canvas_cleared', self._on_canvas_cleared)
        self.sio.on('guess_result', self._on_guess_result)
        self.sio.on('correct_guess', self._on_correct_guess)
        self.sio.on('chat_message', self._on_chat_message)
        self.sio.on('round_end', self._on_round_end)
        self.sio.on('game_end', self._on_game_end)
        self.sio.on('error', self._on_error)
    
    def _on_connect(self):
        self.connected = True
        self.events_received.append(('connect', {}))
    
    def _on_disconnect(self):
        self.connected = False
        self.events_received.append(('disconnect', {}))
    
    def _on_connected(self, data):
        self.events_received.append(('connected', data))
    
    def _on_room_created(self, data):
        self.events_received.append(('room_created', data))
    
    def _on_room_joined(self, data):
        self.events_received.append(('room_joined', data))
    
    def _on_player_joined(self, data):
        self.events_received.append(('player_joined', data))
    
    def _on_game_started(self, data):
        self.events_received.append(('game_started', data))
    
    def _on_new_round(self, data):
        self.events_received.append(('new_round', data))
    
    def _on_stroke_drawn(self, data):
        self.events_received.append(('stroke_drawn', data))
    
    def _on_canvas_cleared(self, data):
        self.events_received.append(('canvas_cleared', data))
    
    def _on_guess_result(self, data):
        self.events_received.append(('guess_result', data))
    
    def _on_correct_guess(self, data):
        self.events_received.append(('correct_guess', data))
    
    def _on_chat_message(self, data):
        self.events_received.append(('chat_message', data))
    
    def _on_round_end(self, data):
        self.events_received.append(('round_end', data))
    
    def _on_game_end(self, data):
        self.events_received.append(('game_end', data))
    
    def _on_error(self, data):
        self.events_received.append(('error', data))
    
    async def connect(self):
        try:
            await self.sio.connect(SOCKET_URL)
            await asyncio.sleep(1)  # Wait for connection to stabilize
            return True
        except Exception as e:
            logger.error(f"Failed to connect {self.client_id}: {e}")
            return False
    
    async def disconnect(self):
        if self.connected:
            await self.sio.disconnect()
    
    async def emit(self, event, data):
        await self.sio.emit(event, data)
    
    def get_events(self, event_type: str = None):
        if event_type:
            return [event for event in self.events_received if event[0] == event_type]
        return self.events_received
    
    def clear_events(self):
        self.events_received = []

async def test_api_endpoints():
    """Test REST API endpoints"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        # Test 1: GET /api/
        try:
            async with session.get(f"{API_BASE}/") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("message") == "Scribble Game API":
                        results.add_result("API Root Endpoint", True, "Returns correct message")
                    else:
                        results.add_result("API Root Endpoint", False, f"Unexpected response: {data}")
                else:
                    results.add_result("API Root Endpoint", False, f"HTTP {response.status}")
        except Exception as e:
            results.add_error("API Root Endpoint", str(e))
        
        # Test 2: GET /api/rooms
        try:
            async with session.get(f"{API_BASE}/rooms") as response:
                if response.status == 200:
                    data = await response.json()
                    if "rooms" in data and isinstance(data["rooms"], list):
                        results.add_result("API Rooms Endpoint", True, f"Returns rooms list with {len(data['rooms'])} rooms")
                    else:
                        results.add_result("API Rooms Endpoint", False, f"Invalid response format: {data}")
                else:
                    results.add_result("API Rooms Endpoint", False, f"HTTP {response.status}")
        except Exception as e:
            results.add_error("API Rooms Endpoint", str(e))
    
    return results

async def test_socket_connection():
    """Test Socket.IO connection"""
    results = TestResults()
    
    client = SocketIOTestClient("test_connection")
    
    try:
        # Test connection
        connected = await client.connect()
        if connected:
            results.add_result("Socket Connection", True, "Successfully connected to Socket.IO server")
            
            # Wait for connected event
            await asyncio.sleep(2)
            connected_events = client.get_events('connected')
            if connected_events:
                results.add_result("Socket Connected Event", True, f"Received connected event: {connected_events[0][1]}")
            else:
                results.add_result("Socket Connected Event", False, "Did not receive connected event")
        else:
            results.add_result("Socket Connection", False, "Failed to connect to Socket.IO server")
        
        await client.disconnect()
    except Exception as e:
        results.add_error("Socket Connection", str(e))
    
    return results

async def test_room_operations():
    """Test room creation and joining"""
    results = TestResults()
    
    client1 = SocketIOTestClient("host")
    client2 = SocketIOTestClient("player")
    
    try:
        # Connect both clients
        await client1.connect()
        await client2.connect()
        await asyncio.sleep(1)
        
        room_code = "TEST123"
        
        # Test room creation
        await client1.emit('create_room', {
            'room_code': room_code,
            'username': 'Alice'
        })
        await asyncio.sleep(1)
        
        room_created_events = client1.get_events('room_created')
        if room_created_events:
            results.add_result("Socket Room Creation", True, f"Room created successfully: {room_created_events[0][1]}")
        else:
            results.add_result("Socket Room Creation", False, "Did not receive room_created event")
        
        # Test room joining
        await client2.emit('join_room', {
            'room_code': room_code,
            'username': 'Bob'
        })
        await asyncio.sleep(1)
        
        room_joined_events = client2.get_events('room_joined')
        if room_joined_events:
            results.add_result("Socket Room Joining", True, f"Room joined successfully: {room_joined_events[0][1]}")
        else:
            results.add_result("Socket Room Joining", False, "Did not receive room_joined event")
        
        # Check player_joined events
        player_joined_events = client1.get_events('player_joined')
        if player_joined_events:
            results.add_result("Socket Player Joined Event", True, f"Received player_joined event: {player_joined_events[0][1]}")
        else:
            results.add_result("Socket Player Joined Event", False, "Did not receive player_joined event")
        
        await client1.disconnect()
        await client2.disconnect()
        
    except Exception as e:
        results.add_error("Room Operations", str(e))
        await client1.disconnect()
        await client2.disconnect()
    
    return results

async def test_game_flow():
    """Test complete game flow"""
    results = TestResults()
    
    client1 = SocketIOTestClient("host")
    client2 = SocketIOTestClient("player")
    
    try:
        # Connect and setup room
        await client1.connect()
        await client2.connect()
        await asyncio.sleep(1)
        
        room_code = "GAME123"
        
        # Create room
        await client1.emit('create_room', {
            'room_code': room_code,
            'username': 'GameHost'
        })
        await asyncio.sleep(1)
        
        # Join room
        await client2.emit('join_room', {
            'room_code': room_code,
            'username': 'GamePlayer'
        })
        await asyncio.sleep(1)
        
        # Start game
        await client1.emit('start_game', {
            'room_code': room_code
        })
        await asyncio.sleep(2)
        
        # Check game started events
        game_started_events = client1.get_events('game_started')
        if game_started_events:
            results.add_result("Socket Game Start", True, "Game started successfully")
        else:
            results.add_result("Socket Game Start", False, "Did not receive game_started event")
        
        # Check new round events
        new_round_events = client1.get_events('new_round')
        if new_round_events:
            results.add_result("Socket New Round", True, f"New round started: {new_round_events[0][1]}")
            
            # Determine who is the drawer
            round_data = new_round_events[0][1]
            drawer_sid = round_data.get('drawer_sid')
            current_word = round_data.get('word')
            
            # Test drawing functionality
            if drawer_sid:
                drawer_client = client1 if client1.sio.sid == drawer_sid else client2
                non_drawer_client = client2 if drawer_client == client1 else client1
                
                # Test draw stroke
                await drawer_client.emit('draw_stroke', {
                    'room_code': room_code,
                    'points': [[10, 10], [20, 20], [30, 30]],
                    'color': '#000000',
                    'width': 3
                })
                await asyncio.sleep(1)
                
                stroke_events = non_drawer_client.get_events('stroke_drawn')
                if stroke_events:
                    results.add_result("Socket Drawing", True, "Draw stroke received by other player")
                else:
                    results.add_result("Socket Drawing", False, "Draw stroke not received")
                
                # Test clear canvas
                await drawer_client.emit('clear_canvas', {
                    'room_code': room_code
                })
                await asyncio.sleep(1)
                
                clear_events = non_drawer_client.get_events('canvas_cleared')
                if clear_events:
                    results.add_result("Socket Canvas Clear", True, "Canvas clear received by other player")
                else:
                    results.add_result("Socket Canvas Clear", False, "Canvas clear not received")
                
                # Test guessing (if we know the word)
                if current_word and current_word != '_' * len(current_word):
                    await non_drawer_client.emit('send_guess', {
                        'room_code': room_code,
                        'guess': current_word
                    })
                    await asyncio.sleep(1)
                    
                    guess_result_events = non_drawer_client.get_events('guess_result')
                    if guess_result_events:
                        guess_data = guess_result_events[0][1]
                        if guess_data.get('correct'):
                            results.add_result("Socket Correct Guess", True, f"Correct guess recognized: {guess_data}")
                        else:
                            results.add_result("Socket Correct Guess", False, f"Guess not recognized as correct: {guess_data}")
                    else:
                        results.add_result("Socket Correct Guess", False, "No guess result received")
                    
                    # Check for correct_guess event
                    correct_guess_events = client1.get_events('correct_guess') + client2.get_events('correct_guess')
                    if correct_guess_events:
                        results.add_result("Socket Correct Guess Broadcast", True, f"Correct guess broadcasted: {correct_guess_events[0][1]}")
                    else:
                        results.add_result("Socket Correct Guess Broadcast", False, "Correct guess not broadcasted")
                
                # Test incorrect guess
                await non_drawer_client.emit('send_guess', {
                    'room_code': room_code,
                    'guess': 'wrongguess'
                })
                await asyncio.sleep(1)
                
                chat_events = client1.get_events('chat_message') + client2.get_events('chat_message')
                if chat_events:
                    results.add_result("Socket Incorrect Guess", True, f"Incorrect guess sent as chat: {chat_events[-1][1]}")
                else:
                    results.add_result("Socket Incorrect Guess", False, "Incorrect guess not handled properly")
            
        else:
            results.add_result("Socket New Round", False, "Did not receive new_round event")
        
        await client1.disconnect()
        await client2.disconnect()
        
    except Exception as e:
        results.add_error("Game Flow", str(e))
        await client1.disconnect()
        await client2.disconnect()
    
    return results

async def main():
    """Run all tests"""
    print("🎮 Starting Scribble Game Backend Tests...")
    print(f"🔗 Testing against: {BACKEND_URL}")
    
    all_results = TestResults()
    
    # Test API endpoints
    print("\n📡 Testing API Endpoints...")
    api_results = await test_api_endpoints()
    all_results.results.update(api_results.results)
    all_results.errors.extend(api_results.errors)
    
    # Test Socket.IO connection
    print("\n🔌 Testing Socket.IO Connection...")
    connection_results = await test_socket_connection()
    all_results.results.update(connection_results.results)
    all_results.errors.extend(connection_results.errors)
    
    # Test room operations
    print("\n🏠 Testing Room Operations...")
    room_results = await test_room_operations()
    all_results.results.update(room_results.results)
    all_results.errors.extend(room_results.errors)
    
    # Test game flow
    print("\n🎯 Testing Game Flow...")
    game_results = await test_game_flow()
    all_results.results.update(game_results.results)
    all_results.errors.extend(game_results.errors)
    
    # Print final summary
    all_results.print_summary()
    
    return all_results

if __name__ == "__main__":
    asyncio.run(main())