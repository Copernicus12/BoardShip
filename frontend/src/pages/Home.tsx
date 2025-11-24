import { Link } from 'react-router-dom';
import PageContainer from "../components/PageContainer";
import useAuth from '../state/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Client as StompClient, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import api from '../utils/api';
import { formatModeLabel } from '../utils/modes';

export default function Home() {
    const { user, token } = useAuth();
    const isLoggedIn = Boolean(token);
    const matchesRefreshAt = useRef(0);
    const isMounted = useRef(true);

    // New state for fetched data
    const [recentMatches, setRecentMatches] = useState(null as null | any[]);
    const [playersOnline, setPlayersOnline] = useState<number | null>(null);
    const [gamesInProgress, setGamesInProgress] = useState<number | null>(null);
    const [availableGames, setAvailableGames] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const matchesErrored = useRef(false);
    const firstLoad = useRef(true);
    const [, setRooms] = useState<any[]>([]);

    // STOMP endpoint shared with Lobby/Game
    const WS_ENDPOINT = import.meta.env.VITE_WS_URL ?? '/ws';

    const updateStatsFromRooms = useCallback((list: any[]) => {
        const waiting = list.filter(r => (r.status ?? '').toLowerCase() === 'waiting').length;
        const inProgress = list.filter(r => (r.status ?? '').toLowerCase().includes('progress')).length;
        const online = list.reduce((sum, r) => sum + (r.currentPlayers ?? 0), 0);
        setAvailableGames(waiting);
        setGamesInProgress(inProgress);
        setPlayersOnline(online);
    }, []);

    const loadMatches = useCallback(async () => {
        try {
            if (matchesErrored.current) return;
            const res = await api.get('/api/matches/recent/global?limit=10');
            if (!isMounted.current) return;
            setRecentMatches(res.data);
        } catch (e: any) {
            if (e?.response?.status === 403) {
                matchesErrored.current = true; // avoid spamming forbidden endpoint
                setError((prev) => prev ?? 'Recent matches unavailable (403)');
                setRecentMatches([]);
                return;
            }
            console.error('Failed to load matches', e);
        }
    }, []);

    // Fallback poll to keep matches fresh even if no lobby events fire
    useEffect(() => {
        const interval = setInterval(loadMatches, 5000);
        return () => clearInterval(interval);
    }, [loadMatches]);

    useEffect(() => {
        isMounted.current = true;
        let client: StompClient | null = null;

        async function loadInitial() {
            if (firstLoad.current) setLoading(true);
            setError(null);
            try {
                const [lobbyRes, matchesRes, onlineRes, roomsRes] = await Promise.allSettled([
                    api.get('/api/lobbies/stats'),
                    api.get('/api/matches/recent/global?limit=10'),
                    api.get('/api/users/online'),
                    api.get('/api/lobbies'),
                ]);

                if (!isMounted.current) return;

                const roomsData = roomsRes.status === 'fulfilled' ? roomsRes.value.data : null;
                const lobbyData = lobbyRes.status === 'fulfilled' ? lobbyRes.value.data : null;
                const matchesData = matchesRes.status === 'fulfilled' ? matchesRes.value.data : null;
                const onlineData = onlineRes.status === 'fulfilled' ? onlineRes.value.data : null;

                if (roomsData) {
                    setRooms(roomsData);
                    updateStatsFromRooms(roomsData);
                }

                if (lobbyData) {
                    setAvailableGames(lobbyData.availableGames ?? null);
                    setPlayersOnline(lobbyData.playersOnline ?? null);
                    setGamesInProgress(lobbyData.gamesInProgress ?? null);
                }

                if (matchesData) {
                    setRecentMatches(matchesData);
                }

                if (onlineData) {
                    setPlayersOnline((prev) => onlineData.count ?? prev);
                }

                if (!roomsData && !lobbyData && !matchesData && !onlineData) {
                    setError('Could not load data right now.');
                }
            } catch (e: any) {
                console.error('Failed to load home data', e);
                setError('Could not load stats right now.');
            } finally {
                if (isMounted.current && firstLoad.current) {
                    setLoading(false);
                    firstLoad.current = false;
                }
            }
        }

        function scheduleMatchesRefresh() {
            const now = Date.now();
            if (now - matchesRefreshAt.current < 2000) return;
            matchesRefreshAt.current = now;
            loadMatches();
        }

        async function connectWs() {
            try {
                client = new StompClient({
                    webSocketFactory: () => new SockJS(WS_ENDPOINT) as any,
                    reconnectDelay: 3000,
                });

                client.onConnect = () => {
                    client?.subscribe('/topic/lobbies', (msg: IMessage) => {
                        try {
                            const payload = JSON.parse(msg.body);
                            if (!payload) return;

                            setRooms(prev => {
                                const map = new Map(prev.map((r: any) => [r.id, r]));

                                if (payload.deleted && payload.id) {
                                    map.delete(payload.id);
                                } else {
                                    const updates: any[] = Array.isArray(payload) ? payload : [payload];
                                    for (const u of updates) {
                                        if (u.id) map.set(u.id, { ...(map.get(u.id) || {}), ...u });
                                    }
                                }

                                const next = Array.from(map.values());
                                updateStatsFromRooms(next);

                                // Always refresh recent matches on lobby updates to keep list current
                                scheduleMatchesRefresh();

                                return next;
                            });
                        } catch (e) {
                            console.error('Invalid lobby update', e);
                        }
                    });
                };

                client.activate();
            } catch (e) {
                console.error('Failed to connect to lobby updates', e);
            }
        }

        loadInitial();
        connectWs();

        return () => {
            isMounted.current = false;
            try { client?.deactivate(); } catch (e) { /* ignore */ }
        };
    }, [loadMatches, updateStatsFromRooms, WS_ENDPOINT]);

    // Choose display matches; no more mock data fallback
    const displayMatches = (recentMatches ?? []).map((m: any) => {
        // Normalize both global and per-user shapes into a common shape with players array
        if (m.playerA !== undefined || m.playerB !== undefined) {
            return {
                id: m.id,
                players: [m.playerA ?? m.playerUsername ?? 'Unknown', m.playerB ?? m.opponent ?? 'Unknown'],
                mode: m.mode ?? m.game,
                result: m.result,
                score: m.score,
                durationSeconds: m.durationSeconds,
                playedAt: m.playedAt,
                date: m.date,
                duration: m.duration
            }
        }

        // legacy per-user RecentMatchResponse shape: has opponent
        if (m.opponent !== undefined) {
            return {
                id: m.id,
                players: [m.opponent, 'Unknown'],
                mode: m.mode ?? m.game,
                result: m.result,
                score: m.score,
                durationSeconds: m.durationSeconds,
                playedAt: m.playedAt,
                date: m.date,
                duration: m.duration
            }
        }

        // fallback
        return {
            id: m.id ?? Math.random().toString(36).slice(2,9),
            players: [m.playerA ?? m.opponent ?? 'Unknown', m.playerB ?? 'Unknown'],
            mode: m.mode ?? m.game ?? 'Unknown',
            result: m.result ?? '—',
            score: m.score ?? '—',
            durationSeconds: m.durationSeconds,
            playedAt: m.playedAt,
            date: m.date,
            duration: m.duration
        }
    }).sort((a, b) => {
        const aTime = a.playedAt ? new Date(a.playedAt).getTime() : 0;
        const bTime = b.playedAt ? new Date(b.playedAt).getTime() : 0;
        return bTime - aTime;
    });

    return (
        <PageContainer maxWidth="max-w-6xl mx-auto px-4 md:px-8">
            {/* HERO */}
            <div className="relative overflow-hidden rounded-3xl border border-accent bg-gradient-to-br from-[#0a1a2b] via-[#0b2035] to-[#0b1220] p-10 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.45)] mb-10">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-neon/10 blur-3xl" />
                    <div className="absolute -bottom-24 -right-10 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(0,180,216,0.15) 0, transparent 35%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.08) 0, transparent 25%)" }} />
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">
                    <div className="flex-1 space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/60 bg-card/40 backdrop-blur-sm text-xs uppercase tracking-[0.2em] text-neon">
                            Tactical Naval Arena
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-neon leading-tight drop-shadow-glow">
                                BoardShip — Command Your Fleet
                            </h1>
                            <p className="text-lg md:text-xl text-muted max-w-2xl">
                                Plan, bluff, and strike with precision. Queue for intense battles or explore new modes tailored for fast-paced skirmishes.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                to={isLoggedIn ? "/lobby" : "/login"}
                                className="px-6 py-3 bg-neon text-navy font-bold rounded-xl shadow-glow hover:translate-y-[-1px] transition"
                            >
                                {isLoggedIn ? "Start a Match" : "Login to Play"}
                            </Link>
                            <Link
                                to={isLoggedIn ? "/leaderboard" : "/register"}
                                className="px-6 py-3 border border-accent text-accent rounded-xl hover:border-neon hover:text-neon transition"
                            >
                                {isLoggedIn ? "View Leaderboard" : "Create Account"}
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-card/70 border border-accent/70 rounded-2xl p-4 shadow-inner">
                                <p className="text-xs uppercase text-muted">Players Online</p>
                                <p className="text-2xl font-bold text-neon">{playersOnline ?? '—'}</p>
                                <p className="text-xs text-muted mt-1">Live crews connected</p>
                            </div>
                            <div className="bg-card/70 border border-accent/70 rounded-2xl p-4 shadow-inner">
                                <p className="text-xs uppercase text-muted">Active Games</p>
                                <p className="text-2xl font-bold text-neon">{gamesInProgress ?? '—'}</p>
                                <p className="text-xs text-muted mt-1">Battles underway</p>
                            </div>
                            <div className="bg-card/70 border border-accent/70 rounded-2xl p-4 shadow-inner">
                                <p className="text-xs uppercase text-muted">Recent Battles</p>
                                <p className="text-2xl font-bold text-neon">{(recentMatches ?? []).length || '—'}</p>
                                <p className="text-xs text-muted mt-1">Latest games played</p>
                            </div>
                            <div className="bg-card/70 border border-accent/70 rounded-2xl p-4 shadow-inner">
                                <p className="text-xs uppercase text-muted">Open Lobbies</p>
                                <p className="text-2xl font-bold text-neon">{availableGames ?? '—'}</p>
                                <p className="text-xs text-muted mt-1">Waiting for captains</p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-[40%]">
                        <div className="relative rounded-3xl border border-neon/30 bg-card/80 backdrop-blur-md p-6 shadow-[0_20px_50px_rgba(0,180,216,0.2)] overflow-hidden">
                            <div className="absolute -inset-16 bg-[radial-gradient(circle_at_30%_30%,rgba(0,180,216,0.28),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.08),transparent_35%)] opacity-60" />
                            <div className="relative space-y-4">
                                <p className="text-sm uppercase tracking-[0.2em] text-neon">Live Intel</p>
                                <h3 className="text-2xl font-bold text-accent">{"Command Center"}</h3>
                                <p className="text-muted text-sm">
                                    {isLoggedIn
                                        ? `Welcome back${user?.username ? `, ${user.username}` : ''}. Queue up or jump into a lobby — your fleet is ready.`
                                        : "Preview the arena. Create an account to unlock matchmaking, ladders, and profile tracking."}
                                </p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-2xl border border-accent/70 bg-[#0d1f33] p-3">
                                        <p className="text-muted text-xs">Recente</p>
                                        <p className="text-lg font-semibold text-neon">{displayMatches.length}</p>
                                        <p className="text-xs text-muted">Battles tracked</p>
                                    </div>
                                    <div className="rounded-2xl border border-accent/70 bg-[#0d1f33] p-3">
                                        <p className="text-muted text-xs">Players Online</p>
                                        <p className="text-lg font-semibold text-neon">{playersOnline ?? '—'}</p>
                                        <p className="text-xs text-muted">Live captains</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted">
                                    {loading && <span>Loading latest stats…</span>}
                                    {error && <span className="text-red-400">{error}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FEATURE STRIP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="flex items-start gap-3 p-5 rounded-2xl border border-accent bg-card/70 hover:border-neon transition">
                    <div className="w-10 h-10 rounded-xl bg-neon/20 flex items-center justify-center text-neon font-bold">1</div>
                    <div>
                        <h4 className="text-lg font-semibold text-accent">Plan & Predict</h4>
                        <p className="text-sm text-muted">Place your fleet, read your opponent, and strike where it hurts.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-5 rounded-2xl border border-accent bg-card/70 hover:border-neon transition">
                    <div className="w-10 h-10 rounded-xl bg-neon/20 flex items-center justify-center text-neon font-bold">2</div>
                    <div>
                        <h4 className="text-lg font-semibold text-accent">Climb the Ladder</h4>
                        <p className="text-sm text-muted">Ranked mode with global leaderboard and clean match history.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-5 rounded-2xl border border-accent bg-card/70 hover:border-neon transition">
                    <div className="w-10 h-10 rounded-xl bg-neon/20 flex items-center justify-center text-neon font-bold">3</div>
                    <div>
                        <h4 className="text-lg font-semibold text-accent">Play Your Speed</h4>
                        <p className="text-sm text-muted">Classic duels or lightning-fast skirmishes — choose your pace.</p>
                    </div>
                </div>
            </div>

            {/* Last Matches Section */}
            <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">Recent Activity</p>
                        <h2 className="text-3xl font-bold text-neon">Latest Battles</h2>
                    </div>
                    <Link
                        to="/profile"
                        className="text-accent hover:text-neon transition text-sm"
                    >
                        View All →
                    </Link>
                </div>

                {displayMatches.length === 0 ? (
                    <div className="bg-card/60 border border-accent/60 rounded-2xl p-6 text-center text-muted">
                        No recent battles yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayMatches.map((match: any, idx: number) => (
                            <div
                                key={match.id ?? idx}
                                className="bg-card border border-accent/80 rounded-2xl p-5 hover:border-neon transition-all hover:shadow-glow group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-accent group-hover:text-neon transition">
                                            {formatModeLabel(match.mode)}
                                        </h3>
                                        <p className="text-sm text-muted">{match.players?.[0]} vs {match.players?.[1]}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        (match.result || '').toLowerCase() === 'won' 
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                    }`}>
                                        {(match.result || '—').toString().toUpperCase()}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex gap-4 flex-wrap">
                                        <div>
                                            <span className="text-muted">Score: </span>
                                            <span className="text-accent font-semibold">{match.score ?? '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted">Duration: </span>
                                            <span className="text-accent font-semibold">{match.durationSeconds ? `${Math.floor(match.durationSeconds/60)}:${String(match.durationSeconds%60).padStart(2,'0')}` : (match.duration ?? '—')}</span>
                                        </div>
                                    </div>
                                    <div className="text-muted text-xs text-right">{match.playedAt ? new Date(match.playedAt).toLocaleString() : (match.date ?? '')}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Game Modes Section */}
            <div className="mt-12">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">Choose Your Arena</p>
                        <h2 className="text-3xl font-bold text-neon">Game Modes</h2>
                    </div>
                    <Link
                        to={isLoggedIn ? "/lobby" : "/login"}
                        className="text-sm px-4 py-2 rounded-lg border border-accent text-accent hover:border-neon hover:text-neon transition"
                    >
                        {isLoggedIn ? "Open Lobby" : "Login to Queue"}
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            name: "Classic Mode",
                            desc: "Traditional turns, full fleet. Best for calculated plays.",
                            badge: "Tactical"
                        },
                        {
                            name: "Speed Battle",
                            desc: "Short timers, quick reads. Great for rapid-fire sessions.",
                            badge: "Fast"
                        },
                        {
                            name: "Ranked Mode",
                            desc: "Climb the ladder, earn your stripes, prove your command.",
                            badge: "Competitive"
                        }
                    ].map((mode) => (
                        <div
                            key={mode.name}
                            className="relative bg-card border border-accent rounded-xl p-6 hover:border-neon hover:shadow-glow transition-all group overflow-hidden"
                        >
                            <div className="absolute inset-0 pointer-events-none opacity-40">
                                <div className="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-neon/15 blur-3xl" />
                                <div className="absolute -bottom-14 -left-12 w-48 h-48 rounded-full bg-accent/10 blur-3xl" />
                            </div>

                            <div className="relative flex items-center justify-between mb-4">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-neon/30 to-accent/20 border border-neon/40 flex items-center justify-center text-neon font-bold">
                                    {mode.name.split(" ")[0].charAt(0)}
                                </div>
                                <span className="text-[11px] uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-neon/15 text-neon border border-neon/40">
                                    {mode.badge}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2">
                                {mode.name}
                            </h3>
                            <p className="text-muted text-sm mb-5">
                                {mode.desc}
                            </p>
                            <div className="flex items-center justify-between text-sm">
                                <Link
                                    to="/lobby"
                                    className="inline-flex items-center gap-2 text-neon hover:underline font-semibold"
                                >
                                    Play Now →
                                </Link>
                                <span className="text-muted text-xs">Live queues available</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </PageContainer>
    )
}
