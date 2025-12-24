from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid
from datetime import datetime
import socketio
import random
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Game state storage (in-memory for MVP)
game_rooms: Dict[str, dict] = {}

# Word bank for the game
WORD_BANK = [
    "cat", "dog", "house", "tree", "car", "sun", "moon", "star", "flower", "bird",
    "fish", "book", "phone", "computer", "guitar", "piano", "camera", "bicycle",
    "umbrella", "chair", "table", "cup", "bottle", "shoe", "hat", "clock",
    "butterfly", "rainbow", "mountain", "beach", "ocean", "river", "bridge",
    "castle", "rocket", "airplane", "boat", "train", "pizza", "burger", "ice cream",
    "cake", "apple", "banana", "carrot", "elephant", "giraffe", "lion", "tiger",
    "penguin", "dolphin", "whale", "octopus", "spider", "butterfly", "snowman",
    "campfire", "tent", "backpack", "glasses", "crown", "sword", "shield"
]

# Models
class RoomCreate(BaseModel):
    room_code: str
    max_players: int = 8

class RoomJoin(BaseModel):
    room_code: str

# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, to=sid)

@sio.event
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")
    
    # Remove player from any room they were in
    for room_code, room in list(game_rooms.items()):
        players_before = len(room['players'])
        room['players'] = [p for p in room['players'] if p['sid'] != sid]
        
        if len(room['players']) < players_before:
            if len(room['players']) == 0:
                # Remove empty room
                del game_rooms[room_code]
            else:
                # Notify other players
                await sio.emit('player_left', {
                    'room_code': room_code,
                    'players': room['players']
                }, room=room_code)
                
                # If drawer left, start new round
                if room.get('current_drawer_sid') == sid and room.get('game_started'):
                    await start_new_round(room_code)

@sio.event
async def create_room(sid, data):
    room_code = data.get('room_code', '').upper()
    username = data.get('username', 'Player')
    
    if room_code in game_rooms:
        await sio.emit('error', {'message': 'Room already exists'}, to=sid)
        return
    
    game_rooms[room_code] = {
        'room_code': room_code,
        'players': [{
            'sid': sid,
            'username': username,
            'score': 0,
            'is_host': True
        }],
        'max_players': 8,
        'game_started': False,
        'current_round': 0,
        'max_rounds': 3,
        'current_drawer_index': 0,
        'current_drawer_sid': None,
        'current_word': None,
        'strokes': [],
        'guessed_players': [],
        'round_start_time': None
    }
    
    await sio.enter_room(sid, room_code)
    await sio.emit('room_created', {
        'room_code': room_code,
        'players': game_rooms[room_code]['players']
    }, to=sid)

@sio.event
async def join_room(sid, data):
    room_code = data.get('room_code', '').upper()
    username = data.get('username', 'Player')
    
    if room_code not in game_rooms:
        await sio.emit('error', {'message': 'Room not found'}, to=sid)
        return
    
    room = game_rooms[room_code]
    
    if len(room['players']) >= room['max_players']:
        await sio.emit('error', {'message': 'Room is full'}, to=sid)
        return
    
    if room['game_started']:
        await sio.emit('error', {'message': 'Game already started'}, to=sid)
        return
    
    room['players'].append({
        'sid': sid,
        'username': username,
        'score': 0,
        'is_host': False
    })
    
    await sio.enter_room(sid, room_code)
    await sio.emit('room_joined', {
        'room_code': room_code,
        'players': room['players']
    }, to=sid)
    
    # Notify all players in room
    await sio.emit('player_joined', {
        'players': room['players']
    }, room=room_code)

@sio.event
async def start_game(sid, data):
    room_code = data.get('room_code', '').upper()
    
    if room_code not in game_rooms:
        await sio.emit('error', {'message': 'Room not found'}, to=sid)
        return
    
    room = game_rooms[room_code]
    
    # Check if sender is host
    is_host = any(p['sid'] == sid and p['is_host'] for p in room['players'])
    if not is_host:
        await sio.emit('error', {'message': 'Only host can start game'}, to=sid)
        return
    
    if len(room['players']) < 2:
        await sio.emit('error', {'message': 'Need at least 2 players'}, to=sid)
        return
    
    room['game_started'] = True
    room['current_round'] = 1
    
    await sio.emit('game_started', {}, room=room_code)
    await start_new_round(room_code)

async def start_new_round(room_code):
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Select next drawer
    drawer = room['players'][room['current_drawer_index']]
    room['current_drawer_sid'] = drawer['sid']
    
    # Select random word
    room['current_word'] = random.choice(WORD_BANK)
    room['strokes'] = []
    room['guessed_players'] = []
    room['round_start_time'] = datetime.now().timestamp()
    
    # Send word to drawer
    await sio.emit('new_round', {
        'round': room['current_round'],
        'drawer': drawer['username'],
        'drawer_sid': drawer['sid'],
        'word': room['current_word'],
        'word_length': len(room['current_word'])
    }, to=drawer['sid'])
    
    # Send round info to other players (without word)
    for player in room['players']:
        if player['sid'] != drawer['sid']:
            await sio.emit('new_round', {
                'round': room['current_round'],
                'drawer': drawer['username'],
                'drawer_sid': drawer['sid'],
                'word': '_' * len(room['current_word']),
                'word_length': len(room['current_word'])
            }, to=player['sid'])
    
    # Start 60 second timer
    asyncio.create_task(round_timer(room_code, 60))

async def round_timer(room_code, duration):
    await asyncio.sleep(duration)
    
    if room_code in game_rooms:
        await end_round(room_code)

async def end_round(room_code):
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Award points to players who guessed
    for player_sid in room['guessed_players']:
        player = next((p for p in room['players'] if p['sid'] == player_sid), None)
        if player:
            player['score'] += 100
    
    # Award points to drawer if anyone guessed
    if len(room['guessed_players']) > 0:
        drawer = next((p for p in room['players'] if p['sid'] == room['current_drawer_sid']), None)
        if drawer:
            drawer['score'] += 50
    
    await sio.emit('round_end', {
        'word': room['current_word'],
        'players': room['players']
    }, room=room_code)
    
    # Move to next round or end game
    room['current_drawer_index'] = (room['current_drawer_index'] + 1) % len(room['players'])
    
    if room['current_drawer_index'] == 0:
        room['current_round'] += 1
    
    if room['current_round'] > room['max_rounds']:
        await end_game(room_code)
    else:
        # Wait 5 seconds before next round
        await asyncio.sleep(5)
        if room_code in game_rooms:
            await start_new_round(room_code)

async def end_game(room_code):
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Sort players by score
    sorted_players = sorted(room['players'], key=lambda p: p['score'], reverse=True)
    
    await sio.emit('game_end', {
        'players': sorted_players
    }, room=room_code)
    
    # Reset game state
    room['game_started'] = False
    room['current_round'] = 0
    room['current_drawer_index'] = 0
    for player in room['players']:
        player['score'] = 0

@sio.event
async def draw_stroke(sid, data):
    room_code = data.get('room_code', '').upper()
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Only drawer can draw
    if room['current_drawer_sid'] != sid:
        return
    
    stroke_data = {
        'points': data.get('points', []),
        'color': data.get('color', '#000000'),
        'width': data.get('width', 3)
    }
    
    room['strokes'].append(stroke_data)
    
    # Broadcast to all players except drawer
    for player in room['players']:
        if player['sid'] != sid:
            await sio.emit('stroke_drawn', stroke_data, to=player['sid'])

@sio.event
async def clear_canvas(sid, data):
    room_code = data.get('room_code', '').upper()
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Only drawer can clear
    if room['current_drawer_sid'] != sid:
        return
    
    room['strokes'] = []
    
    # Broadcast to all players
    await sio.emit('canvas_cleared', {}, room=room_code)

@sio.event
async def send_guess(sid, data):
    room_code = data.get('room_code', '').upper()
    guess = data.get('guess', '').lower().strip()
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Can't guess if you're the drawer
    if room['current_drawer_sid'] == sid:
        return
    
    # Already guessed
    if sid in room['guessed_players']:
        return
    
    player = next((p for p in room['players'] if p['sid'] == sid), None)
    if not player:
        return
    
    # Check if guess is correct
    if guess == room['current_word'].lower():
        room['guessed_players'].append(sid)
        
        # Award points based on how fast they guessed
        time_elapsed = datetime.now().timestamp() - room['round_start_time']
        points = max(50, 200 - int(time_elapsed * 2))
        player['score'] += points
        
        await sio.emit('correct_guess', {
            'player': player['username'],
            'points': points
        }, room=room_code)
        
        await sio.emit('guess_result', {
            'correct': True,
            'points': points
        }, to=sid)
        
        # If all players guessed, end round early
        if len(room['guessed_players']) == len(room['players']) - 1:
            await end_round(room_code)
    else:
        # Broadcast guess to all players
        await sio.emit('chat_message', {
            'username': player['username'],
            'message': guess
        }, room=room_code)
        
        await sio.emit('guess_result', {
            'correct': False
        }, to=sid)

@sio.event
async def send_message(sid, data):
    room_code = data.get('room_code', '').upper()
    message = data.get('message', '')
    
    if room_code not in game_rooms:
        return
    
    player = next((p for r in game_rooms.values() for p in r['players'] if p['sid'] == sid), None)
    if not player:
        return
    
    await sio.emit('chat_message', {
        'username': player['username'],
        'message': message
    }, room=room_code)

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Scribble Game API"}

@api_router.get("/rooms")
async def get_rooms():
    return {
        'rooms': [
            {
                'room_code': code,
                'players': len(room['players']),
                'max_players': room['max_players'],
                'game_started': room['game_started']
            }
            for code, room in game_rooms.items()
        ]
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO app
socket_app = socketio.ASGIApp(sio, app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Export socket_app as the main app for uvicorn
app = socket_app
