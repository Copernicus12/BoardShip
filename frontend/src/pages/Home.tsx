import { Link } from 'react-router-dom';
import PageContainer from "../components/PageContainer";
import useAuth from '../state/auth';
import { useEffect, useState } from 'react';
import api from '../utils/api';
import { formatModeLabel } from '../utils/modes';

// Mock data for last matches - replace with real data later
const mockMatches = [
    {
        id: 1,
        game: 'Battleship Classic',
        opponent: 'Player_123',
        result: 'won',
        score: '10 - 5',
        date: '2 hours ago',
        duration: '12:34'
    },
    {
        id: 2,
        game: 'Speed Battle',
        opponent: 'ProGamer99',
        result: 'lost',
        score: '7 - 10',
        date: '5 hours ago',
        duration: '08:21'
    },
    {
        id: 3,
        game: 'Battleship Classic',
        opponent: 'NavyCommander',
        result: 'won',
        score: '10 - 3',
        date: 'Yesterday',
        duration: '15:47'
    },
    {
        id: 4,
        game: 'Team Battle',
        opponent: 'WarLord_X',
        result: 'won',
        score: '10 - 8',
        date: '2 days ago',
        duration: '18:12'
    }
];

export default function Home() {
    const user = useAuth((state) => state.user);

    // New state for fetched data
    const [recentMatches, setRecentMatches] = useState(null as null | any[]);
    const [playersOnline, setPlayersOnline] = useState<number | null>(null);
    const [gamesInProgress, setGamesInProgress] = useState<number | null>(null);
    const [availableGames, setAvailableGames] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                // Parallel requests: lobby stats + recent matches
                const [lobbyRes, matchesRes, onlineRes] = await Promise.all([
                    api.get('/api/lobbies/stats').catch(() => null),
                    // global recent matches across all accounts (public endpoint)
                    api.get('/api/matches/recent/global?limit=6').catch(() => null),
                    api.get('/api/users/online').catch(() => null),
                ]);

                if (!mounted) return;

                if (lobbyRes && lobbyRes.data) {
                    setAvailableGames(lobbyRes.data.availableGames ?? null);
                    setPlayersOnline(lobbyRes.data.playersOnline ?? null);
                    setGamesInProgress(lobbyRes.data.gamesInProgress ?? null);
                }

                if (matchesRes && matchesRes.data) {
                    // matches contain playedAt as ISO instant strings
                    setRecentMatches(matchesRes.data);
                }

                if (onlineRes && onlineRes.data) {
                    setPlayersOnline(onlineRes.data.count ?? playersOnline);
                }

            } catch (e: any) {
                console.error('Failed to load home data', e);
                setError('Could not load stats. Showing cached/demo data.');
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => { mounted = false };
    }, []);

    // Helper: compute matches played today from recentMatches
    function countMatchesToday(matches: any[] | null) {
        if (!matches || matches.length === 0) return 0;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
        let count = 0;
        for (const m of matches) {
            const playedAt = m.playedAt ? new Date(m.playedAt) : null;
            if (!playedAt) continue;
            const playedStr = playedAt.toISOString().slice(0, 10);
            if (playedStr === todayStr) count++;
        }
        return count;
    }

    // Choose display matches: prefer fetched, fallback to mock
    const displayMatches = (recentMatches ?? mockMatches.map(m => ({
        id: m.id.toString(),
        playerA: 'Unknown',
        playerB: m.opponent,
        mode: m.game,
        result: m.result,
        score: m.score,
        durationSeconds: null,
        playedAt: null,
        date: m.date,
        duration: m.duration
    }))).map((m: any) => {
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
    });

    const matchesToday = countMatchesToday(recentMatches ?? null);

    return (
        <PageContainer>
            {/* Hero Section */}
            <div className="relative mb-12">
                {/* Decorative background */}
                <div className="absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
                </div>

                <div className="text-center py-12">
                    <h1 className="text-5xl md:text-6xl font-bold text-neon mb-4 drop-shadow-glow">
                        BoardShip — Command Your Fleet
                    </h1>
                    {user && (
                        <p className="text-2xl text-accent mb-6">
                            Hello, <span className="text-neon">{user.username}</span>
                        </p>
                    )}
                    <p className="text-lg text-muted max-w-2xl mx-auto mb-8">
                        Face off in tactical naval battles: place your fleet, anticipate enemy moves,
                        and outmaneuver opponents to secure victory. Ranked Mode and casual modes available.
                    </p>

                    <div className="flex gap-4 justify-center">
                        <Link
                            to="/lobby"
                            className="px-8 py-3 bg-neon hover:opacity-90 text-navy font-bold rounded-lg transition shadow-glow"
                        >
                            Start Match
                        </Link>
                        <Link
                            to="/leaderboard"
                            className="px-8 py-3 bg-card border border-accent hover:border-neon text-accent hover:text-neon font-bold rounded-lg transition"
                        >
                            Leaderboard
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">{playersOnline ?? '—'}</div>
                    <div className="text-sm text-muted">Active Players</div>
                </div>
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">{gamesInProgress ?? '—'}</div>
                    <div className="text-sm text-muted">Games in Progress</div>
                </div>
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">{matchesToday ?? '—'}</div>
                    <div className="text-sm text-muted">Battles Today</div>
                </div>
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">{availableGames ?? '—'}</div>
                    <div className="text-sm text-muted">Available Games</div>
                </div>
            </div>

            {/* Error / Loading banner */}
            {loading && (
                <div className="mb-4 text-sm text-muted">Loading latest stats…</div>
            )}
            {error && (
                <div className="mb-4 text-sm text-red-400">{error}</div>
            )}

            {/* Last Matches Section */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-neon">Last Matches</h2>
                    <Link
                        to="/profile"
                        className="text-accent hover:text-neon transition text-sm"
                    >
                        View All →
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayMatches.map((match: any, idx: number) => (
                        <div
                            key={match.id ?? idx}
                            className="bg-card border border-accent rounded-xl p-5 hover:border-neon transition-all hover:shadow-glow group"
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
                                <div className="flex gap-4">
                                    <div>
                                        <span className="text-muted">Score: </span>
                                        <span className="text-accent font-semibold">{match.score ?? '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted">Duration: </span>
                                        <span className="text-accent font-semibold">{match.durationSeconds ? `${Math.floor(match.durationSeconds/60)}:${String(match.durationSeconds%60).padStart(2,'0')}` : (match.duration ?? '—')}</span>
                                    </div>
                                </div>
                                <div className="text-muted text-xs">{match.playedAt ? new Date(match.playedAt).toLocaleString() : (match.date ?? '')}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Game Modes Section */}
            <div className="mt-12">
                <h2 className="text-3xl font-bold text-neon mb-6">Game Modes</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon hover:shadow-glow transition-all group">
                        {/* Anchor SVG icon */}
                        <div className="w-10 h-10 mb-3 mx-auto">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-accent">
                                <path d="M12 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 9a5 5 0 0010 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3 20a9 9 0 0118 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 16v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M17 16v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2 text-center">
                            Classic Mode
                        </h3>
                        <p className="text-muted text-sm mb-4 text-center">
                            Traditional rules: take turns and sink all enemy ships to win.
                        </p>
                        <div className="text-center">
                            <Link
                                to="/lobby"
                                className="inline-block text-neon hover:underline text-sm font-semibold"
                            >
                                Play Now →
                            </Link>
                        </div>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon hover:shadow-glow transition-all group">
                        {/* Speed SVG icon */}
                        <div className="w-10 h-10 mb-3 mx-auto">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-accent">
                                <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M6 6l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2 text-center">
                            Speed Battle
                        </h3>
                        <p className="text-muted text-sm mb-4 text-center">
                            Fast-paced matches with shorter timers — quick decisions win the day.
                        </p>
                        <div className="text-center">
                            <Link
                                to="/lobby"
                                className="inline-block text-neon hover:underline text-sm font-semibold"
                            >
                                Play Now →
                            </Link>
                        </div>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon hover:shadow-glow transition-all group">
                        {/* Target SVG icon */}
                        <div className="w-10 h-10 mb-3 mx-auto">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-accent">
                                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M12 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                <path d="M12 20v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                <path d="M2 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                <path d="M20 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2 text-center">
                            Ranked Mode
                        </h3>
                        <p className="text-muted text-sm mb-4 text-center">
                            Competitive ranked matches — climb the ladder and prove your skill.
                        </p>
                        <div className="text-center">
                            <Link
                                to="/lobby"
                                className="inline-block text-neon hover:underline text-sm font-semibold"
                            >
                                Play Now →
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}