import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from "../components/PageContainer";
import api from '../utils/api';
import useAuth from '../state/auth';
import { Client as StompClient } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// Lobby type
type LobbyItem = {
    id: string;
    name: string;
    hostId?: string;
    hostName?: string;
    mode?: string;
    maxPlayers?: number;
    currentPlayers?: number;
    status?: string;
}

type LobbyStats = {
    availableGames: number;
    playersOnline: number;
    gamesInProgress: number;
}

// STOMP endpoint (SockJS) – backend registers /ws
const WS_ENDPOINT = import.meta.env.VITE_WS_URL ?? '/ws';

export default function Lobby() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [gameName, setGameName] = useState('');
    const [gameMode, setGameMode] = useState('classic');
    const [isCreating, setIsCreating] = useState(false);
    const [rooms, setRooms] = useState<LobbyItem[]>([]);
    const [stats, setStats] = useState<LobbyStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);
    const isMountedRef = useRef(true);
    const navigate = useNavigate();
    const { user } = useAuth();

    const loadStats = useCallback(async () => {
        try {
            const res = await api.get<LobbyStats>('/api/lobbies/stats');
            if (!isMountedRef.current) return;
            setStats(res.data);
            setStatsError(null);
        } catch (error) {
            console.error('Failed to load lobby stats', error);
            if (!isMountedRef.current) return;
            setStatsError('Unable to refresh lobby stats');
        } finally {
            if (!isMountedRef.current) return;
            setLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let client: StompClient | null = null;
        let active = true;

        const connect = async () => {
            try {
                // initial load
                const res = await api.get('/api/lobbies');
                if (!active) return;
                setRooms(res.data);
                setLoadingStats(true);
                await loadStats();

                client = new StompClient({
                    webSocketFactory: () => new SockJS(WS_ENDPOINT) as any,
                    reconnectDelay: 3000,
                });

                client.onConnect = () => {
                    client?.subscribe('/topic/lobbies', (msg: IMessage) => {
                        try {
                            const payload = JSON.parse(msg.body);
                            // If server sent a deletion notice: {id, deleted: true}
                            if (payload && payload.deleted && payload.id) {
                                const delId: string = payload.id;
                                setRooms(prev => prev.filter(r => r.id !== delId));
                                loadStats();
                                return;
                            }
                            // server broadcasts single lobby on create/join; handle both single and array
                            const updates: LobbyItem[] = Array.isArray(payload) ? payload : [payload];
                            setRooms(prev => {
                                const map = new Map(prev.map(r => [r.id, r]));
                                for (const u of updates) map.set(u.id, u);
                                return Array.from(map.values());
                            });
                            loadStats();
                        } catch (e) {
                            console.error('Invalid lobby update', e);
                        }
                    });
                };

                client.activate();
            } catch (e) {
                console.error('Failed to connect to lobby updates', e);
            }
        };

        connect();

        return () => {
            active = false;
            try { client?.deactivate(); } catch (e) { /* ignore */ }
        };
    }, [loadStats]);

    const createLobbyOnServer = async () => {
        setIsCreating(true);
        try {
            const payload = {
                name: gameName,
                mode: gameMode,
                hostId: user?.id || null,
                hostName: user?.username || 'Anonymous',
                maxPlayers: 2
            };
            const res = await api.post('/api/lobbies', payload);
            const lobby: LobbyItem = res.data;
            setShowCreateModal(false);
            navigate(`/game/${lobby.id}`);
        } catch (e) {
            console.error('Create failed', e);
            alert('Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinGame = async (id: string) => {
        try {
            const res = await api.patch(`/api/lobbies/${id}/join`);
            const lobby: LobbyItem = res.data;
            navigate(`/game/${lobby.id}`);
        } catch (err: any) {
            if (err.response?.status === 409) {
                // show message and refresh list
                alert(err.response.data || 'Unable to join lobby');
                const fresh = await api.get('/api/lobbies');
                setRooms(fresh.data);
                return;
            }
            console.error('Join failed', err);
            alert('Failed to join lobby');
        }
    };

    const fallbackAvailableGames = rooms.filter(r => (r.status ?? '').toLowerCase() === 'waiting').length;
    const fallbackPlayersOnline = rooms.reduce((sum, room) => sum + (room.currentPlayers ?? 0), 0);
    const fallbackGamesInProgress = rooms.filter(r => (r.status ?? '').toLowerCase() === 'in-progress').length;

    const availableGamesDisplay = loadingStats || statsError
        ? fallbackAvailableGames
        : stats?.availableGames ?? fallbackAvailableGames;

    const playersOnlineDisplay = loadingStats || statsError
        ? fallbackPlayersOnline
        : stats?.playersOnline ?? fallbackPlayersOnline;

    const gamesInProgressDisplay = loadingStats || statsError
        ? fallbackGamesInProgress
        : stats?.gamesInProgress ?? fallbackGamesInProgress;

    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-neon mb-2">Game Lobby</h1>
                        <p className="text-muted">Join a game or create your own battle</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-neon hover:opacity-90 text-navy font-bold rounded-lg transition shadow-glow"
                    >
                        + Create Game
                    </button>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-card border border-accent rounded-lg p-4">
                        <div className="text-sm text-muted mb-1">Available Games</div>
                        <div className="text-2xl font-bold text-neon">{availableGamesDisplay}</div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4">
                        <div className="text-sm text-muted mb-1">Players Online</div>
                        <div className="text-2xl font-bold text-neon">{playersOnlineDisplay}</div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4">
                        <div className="text-sm text-muted mb-1">Games in Progress</div>
                        <div className="text-2xl font-bold text-neon">{gamesInProgressDisplay}</div>
                    </div>
                </div>
                {statsError && (
                    <div className="mb-8 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
                        ⚠️ {statsError}
                    </div>
                )}

                {/* Game Rooms List */}
                <div className="bg-card border border-accent rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-accent mb-6">Available Rooms</h2>

                    <div className="space-y-3">
                        {rooms.map(room => (
                            <div key={room.id} className="bg-navy border border-accent rounded-lg p-5 hover:border-neon transition-all group flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-accent group-hover:text-neon transition">{room.name}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${room.status === 'waiting' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'}`}>{room.status === 'waiting' ? 'WAITING' : 'IN PROGRESS'}</span>
                                    </div>
                                    <div className="flex gap-6 text-sm text-muted">
                                        <div><span className="text-muted">Host: </span><span className="text-accent">{room.hostName ?? 'Anonymous'}</span></div>
                                        <div>
                                            <span className="text-muted">Mode: </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                room.mode === 'speed' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
                                                room.mode === 'ranked' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                                                'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                            }`}>
                                                {room.mode === 'speed' && '⚡ Speed'}
                                                {room.mode === 'ranked' && '🏆 Ranked'}
                                                {room.mode === 'classic' && '⚓ Classic'}
                                                {!room.mode && '⚓ Classic'}
                                            </span>
                                        </div>
                                        <div><span className="text-muted">Players: </span><span className="text-accent">{(room.currentPlayers ?? 0) + '/' + (room.maxPlayers ?? 0)}</span></div>
                                    </div>
                                </div>
                                <button disabled={room.status !== 'waiting'} onClick={() => handleJoinGame(room.id)} className={`px-6 py-2 rounded-lg font-semibold transition ${room.status === 'waiting' ? 'bg-neon text-navy hover:opacity-90' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>{room.status === 'waiting' ? 'Join' : 'Full'}</button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Create Game Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-accent rounded-xl p-8 max-w-md w-full relative">
                        <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-muted hover:text-neon text-2xl">×</button>
                        <h2 className="text-2xl font-bold text-neon mb-6">Create New Game</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-accent text-sm font-semibold mb-2">Game Name</label>
                                <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Enter game name..." className="w-full px-4 py-2 bg-navy border border-accent rounded-lg text-accent focus:border-neon outline-none transition" />
                            </div>

                            <div>
                                <label className="block text-accent text-sm font-semibold mb-2">Game Mode</label>
                                <select value={gameMode} onChange={(e) => setGameMode(e.target.value)} className="w-full px-4 py-2 bg-navy border border-accent rounded-lg text-accent focus:border-neon outline-none transition">
                                    <option value="classic">⚓ Classic Mode</option>
                                    <option value="speed">⚡ Speed Battle (3s per turn)</option>
                                    <option value="ranked">🏆 Ranked Mode (RP tracking)</option>
                                </select>
                                <div className="mt-2 text-xs text-muted">
                                    {gameMode === 'classic' && '• Classic Battleship gameplay with no time limits'}
                                    {gameMode === 'speed' && '• Fast-paced! Make your move within 3 seconds or lose your turn'}
                                    {gameMode === 'ranked' && '• Competitive mode with Ranking Points (RP) - win to climb the ladder!'}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 bg-navy border border-accent text-accent rounded-lg hover:border-neon transition">Cancel</button>
                                <button onClick={createLobbyOnServer} disabled={!gameName.trim() || isCreating} className="flex-1 px-4 py-2 bg-neon text-navy font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition">{isCreating ? 'Creating...' : 'Create'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </PageContainer>
    )
}
