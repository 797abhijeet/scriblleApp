#!/usr/bin/env python3
"""
Focused Test for Room Creation and Joining Issue
Testing the specific scenario reported by the user
"""

import asyncio
import socketio
import requests
import json
import time

# Configuration
BACKEND_URL = "https://scribbly-draw.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class RoomTestClient:
    def __init__(self, client_name: str):
        self.client_name = client_name
        self.sio = socketio.AsyncClient()
        self.events = []
        self.connected = False
        
        # Setup event handlers
        self.sio.on('connect', self._on_connect)
        self.sio.on('disconnect', self._on_disconnect)
        self.sio.on('connected', self._on_connected)
        self.sio.on('room_created', self._on_room_created)
        self.sio.on('room_joined', self._on_room_joined)
        self.sio.on('player_joined', self._on_player_joined)
        self.sio.on('error', self._on_error)
    
    async def _on_connect(self):
        print(f"[{self.client_name}] ✅ Connected to server")
        self.connected = True
    
    async def _on_disconnect(self):
        print(f"[{self.client_name}] ❌ Disconnected from server")
        self.connected = False
    
    async def _on_connected(self, data):
        print(f"[{self.client_name}] 📡 Received connected event: {data}")
        self.events.append(('connected', data))
    
    async def _on_room_created(self, data):
        print(f"[{self.client_name}] 🏠 Room created: {data}")
        self.events.append(('room_created', data))
    
    async def _on_room_joined(self, data):
        print(f"[{self.client_name}] 🚪 Room joined: {data}")
        self.events.append(('room_joined', data))
    
    async def _on_player_joined(self, data):
        print(f"[{self.client_name}] 👤 Player joined: {data}")
        self.events.append(('player_joined', data))
    
    async def _on_error(self, data):
        print(f"[{self.client_name}] ⚠️ Error: {data}")
        self.events.append(('error', data))
    
    async def connect(self):
        try:
            await self.sio.connect(BACKEND_URL)
            await asyncio.sleep(2)  # Wait for connection to stabilize
            return True
        except Exception as e:
            print(f"[{self.client_name}] ❌ Connection failed: {e}")
            return False
    
    async def disconnect(self):
        if self.connected:
            await self.sio.disconnect()
    
    async def create_room(self, room_code: str, username: str):
        print(f"[{self.client_name}] 🎮 Creating room {room_code} as {username}")
        await self.sio.emit('create_room', {
            'room_code': room_code,
            'username': username
        })
        await asyncio.sleep(2)  # Wait for response
    
    async def join_room(self, room_code: str, username: str):
        print(f"[{self.client_name}] 🚪 Joining room {room_code} as {username}")
        await self.sio.emit('join_room', {
            'room_code': room_code,
            'username': username
        })
        await asyncio.sleep(2)  # Wait for response
    
    def get_last_event(self, event_type: str):
        for event, data in reversed(self.events):
            if event == event_type:
                return data
        return None
    
    def get_all_events(self, event_type: str):
        return [data for event, data in self.events if event == event_type]

async def test_critical_room_scenario():
    """Test the exact scenario reported by the user"""
    print("🔥 CRITICAL TEST: Room Creation and Joining Issue")
    print("Testing: Create room in one tab, join with same code in another tab")
    print("="*80)
    
    room_code = "TEST01"
    
    # Create two clients (simulating two browser tabs)
    tab1 = RoomTestClient("Tab1")
    tab2 = RoomTestClient("Tab2")
    
    try:
        print("\n📋 Step 1: Connect Tab 1 (First Browser Tab)")
        success1 = await tab1.connect()
        if not success1:
            print("❌ CRITICAL FAILURE: Tab 1 failed to connect")
            return False
        
        print("\n📋 Step 2: Tab 1 creates room")
        await tab1.create_room(room_code, "Player1")
        
        # Check if room was created
        room_created = tab1.get_last_event('room_created')
        if not room_created:
            print("❌ CRITICAL FAILURE: Room creation failed - no room_created event")
            return False
        
        print(f"✅ Room created successfully!")
        print(f"   Room Code: {room_created.get('room_code')}")
        print(f"   Players: {room_created.get('players')}")
        
        # Verify Player1 is in the room
        players = room_created.get('players', [])
        if len(players) != 1 or players[0].get('username') != 'Player1':
            print("❌ CRITICAL FAILURE: Player1 not properly added to room")
            return False
        
        print("\n📋 Step 3: Connect Tab 2 (Second Browser Tab)")
        success2 = await tab2.connect()
        if not success2:
            print("❌ CRITICAL FAILURE: Tab 2 failed to connect")
            return False
        
        print("\n📋 Step 4: Tab 2 joins the same room (CRITICAL TEST)")
        await tab2.join_room(room_code, "Player2")
        
        # Check if Tab 2 successfully joined
        room_joined = tab2.get_last_event('room_joined')
        if not room_joined:
            print("❌ CRITICAL FAILURE: Tab 2 could not join room - no room_joined event")
            error_event = tab2.get_last_event('error')
            if error_event:
                print(f"   Error received: {error_event}")
            return False
        
        print(f"✅ Tab 2 successfully joined room!")
        print(f"   Room Code: {room_joined.get('room_code')}")
        print(f"   Players seen by Tab 2: {room_joined.get('players')}")
        
        # Verify Tab 2 sees both players
        players_tab2 = room_joined.get('players', [])
        if len(players_tab2) != 2:
            print(f"❌ CRITICAL FAILURE: Tab 2 sees {len(players_tab2)} players, expected 2")
            print(f"   Players: {players_tab2}")
            return False
        
        # Check player names
        usernames = [p.get('username') for p in players_tab2]
        if 'Player1' not in usernames or 'Player2' not in usernames:
            print(f"❌ CRITICAL FAILURE: Missing expected players. Found: {usernames}")
            return False
        
        print("\n📋 Step 5: Verify Tab 1 also sees both players")
        await asyncio.sleep(1)  # Give time for broadcast
        
        player_joined_events = tab1.get_all_events('player_joined')
        if not player_joined_events:
            print("❌ CRITICAL FAILURE: Tab 1 did not receive player_joined event")
            return False
        
        latest_player_joined = player_joined_events[-1]
        print(f"✅ Tab 1 received player_joined event!")
        print(f"   Players seen by Tab 1: {latest_player_joined.get('players')}")
        
        # Verify Tab 1 now sees both players
        players_tab1 = latest_player_joined.get('players', [])
        if len(players_tab1) != 2:
            print(f"❌ CRITICAL FAILURE: Tab 1 sees {len(players_tab1)} players, expected 2")
            return False
        
        usernames_tab1 = [p.get('username') for p in players_tab1]
        if 'Player1' not in usernames_tab1 or 'Player2' not in usernames_tab1:
            print(f"❌ CRITICAL FAILURE: Tab 1 missing expected players. Found: {usernames_tab1}")
            return False
        
        print("\n📋 Step 6: Verify REST API shows correct room state")
        response = requests.get(f"{API_BASE}/rooms", timeout=10)
        if response.status_code != 200:
            print(f"❌ REST API failed: {response.status_code}")
            return False
        
        rooms_data = response.json()
        test_room = None
        for room in rooms_data.get('rooms', []):
            if room.get('room_code') == room_code:
                test_room = room
                break
        
        if not test_room:
            print("❌ CRITICAL FAILURE: Room not found in REST API")
            print(f"   Available rooms: {rooms_data}")
            return False
        
        if test_room.get('players') != 2:
            print(f"❌ CRITICAL FAILURE: REST API shows {test_room.get('players')} players, expected 2")
            return False
        
        print(f"✅ REST API correctly shows room with 2 players!")
        print(f"   Room data: {test_room}")
        
        print("\n" + "="*80)
        print("🎉 SUCCESS: Room creation and joining works perfectly!")
        print("✅ Tab 1 can create a room")
        print("✅ Tab 2 can join the same room using the room code")
        print("✅ Both tabs see both players")
        print("✅ REST API shows correct room state")
        print("="*80)
        
        return True
        
    except Exception as e:
        print(f"❌ CRITICAL FAILURE: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        await tab1.disconnect()
        await tab2.disconnect()

async def test_multiple_joins():
    """Test multiple players joining the same room"""
    print("\n🔥 ADDITIONAL TEST: Multiple Players Joining Same Room")
    print("="*60)
    
    room_code = "MULTI01"
    clients = []
    
    try:
        # Create 3 clients
        for i in range(3):
            client = RoomTestClient(f"Player{i+1}")
            clients.append(client)
            success = await client.connect()
            if not success:
                print(f"❌ Player{i+1} failed to connect")
                return False
        
        # First player creates room
        await clients[0].create_room(room_code, "Host")
        await asyncio.sleep(1)
        
        # Other players join
        for i in range(1, 3):
            await clients[i].join_room(room_code, f"Player{i+1}")
            await asyncio.sleep(1)
        
        # Verify all players see all players
        await asyncio.sleep(2)  # Give time for all events
        
        # Check final state via REST API
        response = requests.get(f"{API_BASE}/rooms", timeout=10)
        rooms_data = response.json()
        
        test_room = None
        for room in rooms_data.get('rooms', []):
            if room.get('room_code') == room_code:
                test_room = room
                break
        
        if test_room and test_room.get('players') == 3:
            print("✅ Multiple joins successful - 3 players in room")
            return True
        else:
            print(f"❌ Multiple joins failed - expected 3 players, got {test_room.get('players') if test_room else 0}")
            return False
    
    except Exception as e:
        print(f"❌ Multiple joins test failed: {e}")
        return False
    
    finally:
        for client in clients:
            await client.disconnect()

async def main():
    """Run the focused room tests"""
    print("🎮 SCRIBBLE GAME - ROOM CREATION & JOINING TEST")
    print(f"🔗 Testing against: {BACKEND_URL}")
    print("🎯 Focus: User reported issue with room joining")
    
    # Test 1: Critical scenario
    success1 = await test_critical_room_scenario()
    
    # Test 2: Multiple joins
    success2 = await test_multiple_joins()
    
    print("\n" + "="*80)
    print("📊 FINAL TEST RESULTS")
    print("="*80)
    
    if success1:
        print("✅ CRITICAL TEST PASSED: Room creation and joining works")
    else:
        print("❌ CRITICAL TEST FAILED: Room creation and joining broken")
    
    if success2:
        print("✅ MULTIPLE JOINS TEST PASSED: Multiple players can join")
    else:
        print("❌ MULTIPLE JOINS TEST FAILED: Multiple joins broken")
    
    if success1 and success2:
        print("\n🎉 ALL TESTS PASSED - Room functionality is working correctly!")
        print("💡 The user's reported issue may be resolved or was a temporary problem.")
    else:
        print("\n⚠️ ISSUES FOUND - Room functionality has problems that need fixing.")
    
    return success1 and success2

if __name__ == "__main__":
    asyncio.run(main())