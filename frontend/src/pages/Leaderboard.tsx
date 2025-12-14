import { useEffect, useRef, useState } from 'react';
import { Award, Target, TrendingUp, Zap } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import api from '../utils/api';

type Player = {
    username: string;
    score: number;
    rank?: string;
    icon?: string;
    wins: number;
    losses: number;
    totalGames: number;
    winRate: number;
};

type SortBy = 'rp' | 'wins' | 'winrate';
type Category = 'all' | 'classic' | 'ranked' | 'speed';

const getWinRateColor = (value: number) => {
    if (value >= 70) return 'text-green-400';
    if (value >= 60) return 'text-lime-400';
    if (value >= 50) return 'text-yellow-400';
    if (value >= 40) return 'text-orange-400';
    return 'text-red-400';
};

export default function Leaderboard() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>('rp');
    const [category, setCategory] = useState<Category>('all');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const categoryRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const abortController = new AbortController();
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                const categoryParam = category !== 'all' ? `&category=${category}` : '';
                const res = await api.get(`/api/leaderboard?limit=100&sortBy=${sortBy}${categoryParam}`, {
                    signal: abortController.signal,
                });

                if (cancelled) return;

                let data: Player[] = [];
                if (Array.isArray(res.data)) {
                    data = res.data;
                } else if (res.data && typeof res.data === 'object') {
                    data = res.data.players || res.data.leaderboard || [];
                }

                if (!Array.isArray(data)) {
                    console.error('Invalid leaderboard data format:', res.data);
                    data = [];
                }

                setPlayers(data);
                setError(null);
            } catch (e: any) {
                if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || cancelled) {
                    console.log('Leaderboard request cancelled');
                    return;
                }

                console.error('Failed to load leaderboard:', e);

                if (!cancelled) {
                    const mock: Player[] = [
                        { username: 'CaptainA', score: 3400, rank: 'Diamond', icon: '💎', wins: 85, losses: 15, totalGames: 100, winRate: 85.0 },
                        { username: 'SeaWolf', score: 2880, rank: 'Gold', icon: '🥇', wins: 72, losses: 28, totalGames: 100, winRate: 72.0 },
                        { username: 'BlueAnchor', score: 2420, rank: 'Gold', icon: '🥇', wins: 60, losses: 40, totalGames: 100, winRate: 60.0 },
                        { username: 'Razor', score: 1880, rank: 'Silver', icon: '🥈', wins: 47, losses: 53, totalGames: 100, winRate: 47.0 },
                        { username: 'Gale', score: 1500, rank: 'Silver', icon: '🥈', wins: 38, losses: 42, totalGames: 80, winRate: 47.5 },
                        { username: 'Nova', score: 1200, rank: 'Silver', icon: '🥈', wins: 30, losses: 30, totalGames: 60, winRate: 50.0 },
                    ];
                    setPlayers(mock);
                    setError('Failed to load leaderboard from server');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [sortBy, category]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
                setCategoryOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayPlayers = Array.isArray(players) ? players : [];

    const sortOptions = [
        { key: 'rp' as SortBy, label: 'Rank Points', icon: <Award size={16} /> },
        { key: 'wins' as SortBy, label: 'Victories', icon: <Target size={16} /> },
        { key: 'winrate' as SortBy, label: 'Win Rate', icon: <TrendingUp size={16} /> },
    ];

    const categoryLabels: Record<Category, string> = {
        all: 'All modes',
        classic: 'Classic',
        ranked: 'Ranked',
        speed: 'Speed',
    };

    return (
        <PageContainer maxWidth="max-w-6xl mx-auto px-3 md:px-6">
            <div className="rounded-3xl border border-accent/30 bg-card/70 backdrop-blur p-6 md:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon/10 border border-neon/30 text-[11px] uppercase tracking-[0.18em] text-neon">
                            <Zap size={14} />
                            <span>Leaderboard</span>
                        </div>
                        <h1 className="text-3xl font-bold text-accent">Live leaderboard</h1>
                        <p className="text-sm text-muted leading-relaxed">
                            Inspired by the reference board: two clean columns, a quick top rail, and a clear list in the same neon/minimal style.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex flex-wrap gap-2">
                            {sortOptions.map(({ key, label, icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setSortBy(key)}
                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold border transition-all ${
                                        sortBy === key
                                            ? 'border-neon/50 bg-neon/10 text-neon'
                                            : 'border-accent/30 bg-navy/50 text-accent hover:border-neon/40 hover:text-neon'
                                    }`}
                                >
                                    {icon}
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="relative shrink-0" ref={categoryRef}>
                            <button
                                onClick={() => setCategoryOpen((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold border border-accent/40 bg-card text-accent hover:border-neon/40 hover:text-neon transition-all"
                            >
                                <span className="h-2 w-2 rounded-full bg-neon shadow-glow" />
                                <span>{categoryLabels[category]}</span>
                            </button>
                            {categoryOpen && (
                                <div className="absolute top-full mt-2 left-0 right-auto origin-top-left w-44 min-w-[11rem] max-w-[calc(100vw-2rem)] rounded-xl border border-accent/40 bg-card/95 shadow-xl overflow-hidden z-40 backdrop-blur-sm">
                                    {(['all', 'classic', 'ranked', 'speed'] as Category[]).map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setCategory(c);
                                                setCategoryOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                                category === c
                                                    ? 'bg-neon/15 text-neon'
                                                    : 'text-accent hover:bg-navy/60'
                                            }`}
                                        >
                                            {categoryLabels[c]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-[240px,1fr] gap-4 md:gap-6">
                    {/* Left column: quick shortlist similar to the reference layout */}
                    <div className="rounded-2xl border border-accent/25 bg-navy/60 backdrop-blur p-4 space-y-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">Quick top</p>
                        <div className="space-y-2">
                            {(displayPlayers.slice(0, 8)).map((p, i) => {
                                const isActive = i === 0;
                                return (
                                    <div
                                        key={p.username}
                                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                                            isActive
                                                ? 'border-neon/50 bg-neon/10 text-neon'
                                                : 'border-accent/25 bg-card/60 text-accent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`h-7 w-7 flex items-center justify-center rounded-md text-xs font-bold ${
                                                isActive ? 'bg-neon/20 text-neon border border-neon/40' : 'bg-navy/70 text-accent border border-accent/25'
                                            }`}>
                                                {i + 1}
                                            </span>
                                            <span className="truncate">{p.username}</span>
                                        </div>
                                        <span className="text-[11px] text-muted">{p.score.toLocaleString()} RP</span>
                                    </div>
                                );
                            })}
                            {!displayPlayers.length && !loading && (
                                <p className="text-muted text-sm">No players yet.</p>
                            )}
                            {loading && (
                                <div className="space-y-2">
                                    <div className="h-10 rounded-lg bg-navy/50 animate-pulse" />
                                    <div className="h-10 rounded-lg bg-navy/50 animate-pulse" />
                                    <div className="h-10 rounded-lg bg-navy/50 animate-pulse" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column: simple, spacious table */}
                    <div className="rounded-2xl border border-accent/25 bg-navy/50 backdrop-blur overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-accent/20">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Live positions</p>
                                <h2 className="text-lg font-semibold text-accent">Leaderboard</h2>
                            </div>
                            <span className="text-xs text-muted">{displayPlayers.length} registered</span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center gap-2 px-6 py-10 text-muted">
                                <div className="h-10 w-10 rounded-full border-2 border-accent/50 border-t-neon animate-spin" />
                                <p className="text-sm">Loading leaderboard...</p>
                            </div>
                        ) : displayPlayers.length ? (
                            <div className="divide-y divide-accent/15">
                                {displayPlayers.map((p, i) => {
                                    const rankBadge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
                                    return (
                                        <div
                                            key={p.username}
                                            className="flex flex-col gap-2 sm:grid sm:grid-cols-[64px,1.4fr,1fr,1fr,0.9fr] sm:items-center px-3 md:px-6 py-3 hover:bg-card/40 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`h-10 w-10 rounded-lg border text-sm font-bold flex items-center justify-center ${
                                                    i === 0 ? 'border-neon/60 text-neon' :
                                                    i === 1 ? 'border-accent/50 text-accent' :
                                                    i === 2 ? 'border-orange-400/50 text-orange-200' :
                                                    'border-accent/25 text-accent'
                                                }`}>
                                                    {rankBadge}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-accent truncate">{p.username}</p>
                                                <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                                                    {p.rank && p.icon && (
                                                        <span className="px-2 py-0.5 rounded-full border border-accent/25 bg-card flex items-center gap-1">
                                                            <span>{p.icon}</span>
                                                            <span>{p.rank}</span>
                                                        </span>
                                                    )}
                                                    <span className="uppercase tracking-[0.12em] text-neon/80">#{i + 1}</span>
                                                </div>
                                                {/* Mobile quick stats */}
                                                <div className="sm:hidden mt-2 flex items-center justify-between gap-2 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted uppercase tracking-[0.12em]">RP</span>
                                                        <span className="text-neon font-bold">{p.score.toLocaleString()}</span>
                                                    </div>
                                                    <div className={`font-semibold ${getWinRateColor(p.winRate)}`}>
                                                        {p.winRate.toFixed(1)}% WR
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="hidden sm:block">
                                                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">RP</p>
                                                <p className="text-lg font-bold text-neon">{p.score.toLocaleString()}</p>
                                            </div>
                                            <div className="hidden sm:block">
                                                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Win rate</p>
                                                <p className={`text-sm font-semibold ${getWinRateColor(p.winRate)}`}>{p.winRate.toFixed(1)}%</p>
                                                <div className="mt-1 h-1.5 rounded-full bg-navy/60 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            p.winRate >= 70 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                            p.winRate >= 60 ? 'bg-gradient-to-r from-lime-500 to-lime-400' :
                                                            p.winRate >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                            p.winRate >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                                                            'bg-gradient-to-r from-red-500 to-red-400'
                                                        }`}
                                                        style={{ width: `${Math.min(p.winRate, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="hidden sm:block">
                                                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">W / L</p>
                                                <p className="text-sm text-accent font-medium">{p.wins}W · {p.losses}L</p>
                                                <p className="text-[11px] text-muted">Matches {p.totalGames}</p>
                                            </div>
                                            {/* Mobile bottom bar */}
                                            <div className="sm:hidden flex items-center justify-between gap-3 text-xs text-muted">
                                                <span>{p.wins}W · {p.losses}L</span>
                                                <span className="text-muted">Matches {p.totalGames}</span>
                                            </div>
                                            <div className="sm:hidden h-1.5 rounded-full bg-navy/60 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        p.winRate >= 70 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                        p.winRate >= 60 ? 'bg-gradient-to-r from-lime-500 to-lime-400' :
                                                        p.winRate >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                        p.winRate >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                                                        'bg-gradient-to-r from-red-500 to-red-400'
                                                    }`}
                                                    style={{ width: `${Math.min(p.winRate, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="px-6 py-10 text-center text-muted">
                                <div className="text-4xl mb-3 opacity-70">🏝️</div>
                                <p className="text-sm md:text-base">No captains yet. Win the first match and take the #1 spot.</p>
                            </div>
                        )}

                        {error && (
                            <div className="px-4 md:px-6 py-3 bg-gradient-to-r from-red-500/15 to-red-500/10 border-t border-red-500/25 text-red-300 text-sm">
                                ⚠️ {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
