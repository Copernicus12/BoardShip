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

// Prefer explicit endpoint; otherwise build one that hits the backend directly (bypasses Vite proxy)
const buildWsEndpoint = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
    const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https://' : 'http://';
    return `${protocol}${host}:8080/ws`;
};
const WS_ENDPOINT = buildWsEndpoint();

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

    const refreshLobbyData = useCallback(async () => {
        setLoadingStats(true);
        try {
            const res = await api.get('/api/lobbies');
            if (!isMountedRef.current) return;
            setRooms(res.data);
        } catch (error) {
            console.error('Failed to refresh rooms', error);
        } finally {
            await loadStats();
        }
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
            <div className="relative">
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="absolute -right-24 top-6 w-96 h-96 bg-[radial-gradient(circle_at_center,_rgba(0,180,216,0.18),_transparent_60%)] blur-3xl" />
                    <div className="absolute -left-16 bottom-0 w-[28rem] h-[28rem] bg-[radial-gradient(circle_at_center,_rgba(72,202,228,0.15),_transparent_55%)] blur-3xl" />
                    <div className="absolute inset-x-16 top-20 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
                    <div className="absolute inset-y-10 left-1/2 w-px bg-gradient-to-b from-transparent via-neon/25 to-transparent" />
                </div>

                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-stretch">
                        <div className="relative overflow-hidden rounded-2xl border border-accent bg-card/80 p-8">
                            <div className="absolute inset-0 bg-gradient-to-br from-neon/10 via-transparent to-cyan/10" />
                            <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-neon/15 blur-3xl" />
                            <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-cyan/15 blur-3xl" />
                            <div className="relative z-10 space-y-5">
                                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
                                    <span className="px-3 py-1 rounded-full border border-accent bg-navy/60 text-neon font-semibold">Live Lobby</span>
                                    <span className="px-3 py-1 rounded-full border border-accent/80 bg-card text-accent">Synced in real time</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-xl bg-neon/20 border border-neon/40 flex items-center justify-center text-neon font-bold">
                                        B
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.28em] text-muted">Battle Bridge</p>
                                        <h1 className="text-3xl md:text-4xl font-bold text-neon leading-tight">Lobby Command Center</h1>
                                    </div>
                                </div>
                                <p className="text-lg text-accent max-w-2xl">
                                    Pick a room, track the fleet, and launch instantly. Same sleek neon flow as login/register, built for fast joins.
                                </p>
                                <div className="grid sm:grid-cols-3 gap-3">
                                    {[
                                        { title: 'Instant join', desc: 'Hop in with one click, no clutter.' },
                                        { title: 'Clean signal', desc: 'Stats update live with websocket sync.' },
                                        { title: 'Curated modes', desc: 'Classic, Speed, or Ranked - pick your tempo.' },
                                    ].map((item) => (
                                        <div key={item.title} className="rounded-xl border border-accent bg-navy/50 p-3">
                                            <p className="text-sm font-semibold text-neon">{item.title}</p>
                                            <p className="text-xs text-muted">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3 pt-1">
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="px-5 py-3 rounded-lg bg-neon text-navy font-semibold shadow-glow hover:opacity-95 transition"
                                    >
                                        Create a room
                                    </button>
                                    <button
                                        onClick={refreshLobbyData}
                                        className="px-5 py-3 rounded-lg border border-accent text-accent hover:border-neon hover:text-neon transition"
                                    >
                                        Refresh signals
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="relative rounded-2xl border border-neon/40 bg-card/80 backdrop-blur p-6 overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0))]" />
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Live Stats</p>
                                    <span className="px-3 py-1 rounded-full border border-neon/40 text-[12px] text-neon font-semibold bg-neon/10">
                                        Updated {loadingStats ? '...' : 'now'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-accent bg-navy/60 p-4">
                                        <p className="text-sm text-muted mb-1">Available Games</p>
                                        <p className="text-3xl font-bold text-neon">{availableGamesDisplay}</p>
                                    </div>
                                    <div className="rounded-xl border border-accent bg-navy/60 p-4">
                                        <p className="text-sm text-muted mb-1">Players Online</p>
                                        <p className="text-3xl font-bold text-neon">{playersOnlineDisplay}</p>
                                    </div>
                                    <div className="rounded-xl border border-accent bg-navy/60 p-4">
                                        <p className="text-sm text-muted mb-1">Games in Progress</p>
                                        <p className="text-3xl font-bold text-neon">{gamesInProgressDisplay}</p>
                                    </div>
                                </div>
                                {statsError && (
                                    <div className="rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                                        {statsError}
                                    </div>
                                )}
                                <div className="rounded-xl border border-accent/60 bg-navy/50 p-4 space-y-2">
                                    <p className="text-xs uppercase tracking-[0.12em] text-muted">Quick look</p>
                                    <div className="grid grid-cols-2 gap-3 text-sm text-accent">
                                        <div className="rounded-lg bg-card/60 border border-accent/60 p-3">
                                            <p className="text-muted text-xs">You</p>
                                            <p className="font-semibold text-neon">{user?.username ?? 'Anonymous'}</p>
                                        </div>
                                        <div className="rounded-lg bg-card/60 border border-accent/60 p-3">
                                            <p className="text-muted text-xs">Mode preference</p>
                                            <p className="font-semibold text-accent capitalize">{gameMode}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted">Stay on this page; rooms update in real time.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative rounded-2xl border border-accent bg-card/80 p-6 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-neon/5 via-transparent to-cyan/10" />
                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted">Rooms</p>
                                    <h2 className="text-2xl font-bold text-accent">Available Rooms</h2>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={refreshLobbyData}
                                        className="px-4 py-2 rounded-lg border border-accent text-accent hover:border-neon hover:text-neon transition text-sm"
                                    >
                                        Refresh list
                                    </button>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="px-4 py-2 rounded-lg bg-neon text-navy font-semibold hover:opacity-95 transition text-sm"
                                    >
                                        New room
                                    </button>
                                </div>
                            </div>

                            {rooms.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-accent/60 bg-navy/40 p-6 text-center text-muted">
                                    No rooms available yet. Create one and be the first to launch.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {rooms.map(room => (
                                        <div
                                            key={room.id}
                                            className="relative overflow-hidden rounded-xl border border-accent bg-navy/60 p-5 transition hover:border-neon"
                                        >
                                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-neon via-cyan to-transparent opacity-60" />
                                            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <h3 className="text-xl font-semibold text-accent">{room.name}</h3>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                                                            room.status === 'waiting'
                                                                ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                                                                : 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40'
                                                        }`}>
                                                            {room.status === 'waiting' ? 'Waiting' : 'In progress'}
                                                        </span>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                                            room.mode === 'speed'
                                                                ? 'border-orange-400/50 text-orange-200 bg-orange-500/15'
                                                                : room.mode === 'ranked'
                                                                    ? 'border-purple-400/50 text-purple-200 bg-purple-500/15'
                                                                    : 'border-blue-400/50 text-blue-200 bg-blue-500/15'
                                                        }`}>
                                                            {room.mode ? room.mode.charAt(0).toUpperCase() + room.mode.slice(1) : 'Classic'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-6 text-sm text-muted">
                                                        <div className="flex items-center gap-2">
                                                            <span className="h-2 w-2 rounded-full bg-neon shadow-glow" />
                                                            <span>Host:</span>
                                                            <span className="text-accent font-semibold">{room.hostName ?? 'Anonymous'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="h-2 w-2 rounded-full bg-cyan shadow-glow" />
                                                            <span>Players:</span>
                                                            <span className="text-accent font-semibold">{(room.currentPlayers ?? 0) + '/' + (room.maxPlayers ?? 0)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        disabled={room.status !== 'waiting'}
                                                        onClick={() => handleJoinGame(room.id)}
                                                        className={`px-5 py-2 rounded-lg font-semibold transition ${
                                                            room.status === 'waiting'
                                                                ? 'bg-neon text-navy hover:opacity-95'
                                                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {room.status === 'waiting' ? 'Join room' : 'Full'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-lg rounded-2xl border border-neon/30 bg-card/90 p-8 overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,180,216,0.18),_transparent_55%)] blur-2xl" />
                        <div className="absolute inset-0 bg-[linear-gradient(145deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0))]" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-muted">New session</p>
                                    <h2 className="text-2xl font-bold text-neon">Create a room</h2>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-muted hover:text-neon text-2xl leading-none"
                                    aria-label="Close modal"
                                >
                                    x
                                </button>
                            </div>

                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-sm font-semibold text-accent">Room name</span>
                                    <input
                                        type="text"
                                        value={gameName}
                                        onChange={(e) => setGameName(e.target.value)}
                                        placeholder="Ex: Evening skirmish"
                                        className="mt-2 w-full rounded-lg border border-accent bg-navy/60 px-4 py-3 text-accent placeholder:text-muted focus:border-neon outline-none transition"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-accent">Game mode</span>
                                    <select
                                        value={gameMode}
                                        onChange={(e) => setGameMode(e.target.value)}
                                        className="mt-2 w-full rounded-lg border border-accent bg-navy/60 px-4 py-3 text-accent focus:border-neon outline-none transition"
                                    >
                                        <option value="classic">Classic mode</option>
                                        <option value="speed">Speed battle (3s per turn)</option>
                                        <option value="ranked">Ranked mode (RP tracking)</option>
                                    </select>
                                    <div className="mt-2 text-xs text-muted">
                                        {gameMode === 'classic' && 'Classic Battleship gameplay with no time limits.'}
                                        {gameMode === 'speed' && 'Fast-paced - you have 3 seconds per turn.'}
                                        {gameMode === 'ranked' && 'Competitive with RP tracking; climb the ladder.'}
                                    </div>
                                </label>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 rounded-lg border border-accent bg-card px-4 py-3 text-accent hover:border-neon transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createLobbyOnServer}
                                        disabled={!gameName.trim() || isCreating}
                                        className="flex-1 rounded-lg bg-neon px-4 py-3 text-navy font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {isCreating ? 'Creating...' : 'Launch room'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}
