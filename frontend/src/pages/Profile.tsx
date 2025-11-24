import { useState, useEffect } from 'react';
import PageContainer from "../components/PageContainer";
import RankDisplay from "../components/RankDisplay";
import useAuth from "../state/auth";
import api from "../utils/api";
import { calculateAchievements } from "../utils/achievements";
import { formatModeLabel } from "../utils/modes";

type RankInfo = {
    rank: string;
    icon: string;
    color: string;
    currentRP: number;
    minRP: number;
    maxRP: number;
    progressToNext: number;
    nextRank: string | null;
    rpToNext: number;
};

type UserStats = {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
    rankInfo: RankInfo;
};

type Match = {
    id: string;
    opponent: string;
    mode: string;
    result: string;
    score: string;
    pointsChange: number | null;
    durationSeconds: number | null;
    playedAt: string;
};

type ModeStats = {
    mode: string;
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
};

type StatsByMode = {
    ranked: ModeStats;
    classic: ModeStats;
    speed: ModeStats;
};

type FrequentOpponent = {
    username: string;
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
};

export default function Profile() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [statsByMode, setStatsByMode] = useState<StatsByMode | null>(null);
    const [frequentOpponents, setFrequentOpponents] = useState<FrequentOpponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchPage, setMatchPage] = useState(0);
    const [achievementPage, setAchievementPage] = useState(0);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            const [statsRes, matchesRes, modesRes, opponentsRes] = await Promise.all([
                api.get('/api/users/stats'),
                api.get('/api/matches/history'),
                api.get('/api/users/stats/by-mode'),
                api.get('/api/users/opponents/frequent')
            ]);

            setStats(statsRes.data);
            setMatches(Array.isArray(matchesRes.data) ? matchesRes.data : []);
            setStatsByMode(modesRes.data);
            setFrequentOpponents(Array.isArray(opponentsRes.data) ? opponentsRes.data : []);
        } catch (error) {
            console.error('Failed to load profile', error);
            setMatches([]);
            setFrequentOpponents([]);
            setStatsByMode(null);
            setStats(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) void fetchProfileData();

        const onStorage = (e: StorageEvent) => {
            if (e.key === 'profile:refresh') void fetchProfileData();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [user]);

    const achievements = stats ? calculateAchievements({
        totalGames: stats.totalGames,
        wins: stats.wins,
        losses: stats.losses,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        winRate: stats.winRate,
        rank: stats.rankInfo?.rank,
    }) : [];

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const achievementProgress = achievements.length ? Math.round((unlockedCount / achievements.length) * 100) : 0;
    const achievementPageSize = 3;
    const totalAchievementPages = Math.max(1, Math.ceil(achievements.length / achievementPageSize));
    const safeAchievementPage = Math.min(achievementPage, totalAchievementPages - 1);
    const pagedAchievements = achievements.slice(safeAchievementPage * achievementPageSize, safeAchievementPage * achievementPageSize + achievementPageSize);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    const pageSize = 4;
    const totalMatchPages = Math.max(1, Math.ceil(matches.length / pageSize));
    const safePage = Math.min(matchPage, totalMatchPages - 1);
    const pagedMatches = matches.slice(safePage * pageSize, safePage * pageSize + pageSize);

    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-neon text-xl md:text-2xl">Loading profile...</div>
                    </div>
                ) : (
                    <>
                        <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-accent/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-neon/10 via-transparent to-accent/10" />
                            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                                    <div className="relative">
                                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-neon to-accent blur opacity-60" />
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=0b1220&color=00b4d8&size=256&bold=true`}
                                            alt="avatar"
                                            className="relative w-16 h-16 md:w-24 md:h-24 rounded-full border-2 md:border-3 border-neon shadow-lg"
                                        />
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <h1 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon via-cyan to-accent truncate">
                                            {user?.username || 'Guest'}
                                        </h1>
                                        <p className="text-sm text-muted truncate">{user?.email || 'No email provided'}</p>
                                        {stats?.rankInfo && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-neon/60 bg-neon/10 text-neon">
                                                    {stats.rankInfo.rank}
                                                </span>
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-accent/50 bg-accent/10 text-accent">
                                                    {stats.rankInfo.currentRP} RP
                                                </span>
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-accent/30 text-muted">
                                                    {stats.totalGames} games
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="self-start md:self-auto px-4 py-2 rounded-xl border border-red-400/60 text-red-300 font-semibold hover:bg-red-500/15 transition"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>

                        {stats && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[{
                                    label: 'Win rate', value: `${(stats.winRate ?? 0).toFixed(1)}%`, accent: 'text-neon'
                                }, {
                                    label: 'Wins', value: stats.wins ?? 0, accent: 'text-green-300'
                                }, {
                                    label: 'Streak', value: stats.currentStreak ?? 0, accent: 'text-orange-300'
                                }, {
                                    label: 'Best streak', value: stats.bestStreak ?? 0, accent: 'text-accent'
                                }].map(card => (
                                    <div key={card.label} className="rounded-2xl border border-accent/30 bg-card/40 p-4 shadow-lg">
                                        <div className={`text-2xl font-black ${card.accent}`}>{card.value}</div>
                                        <div className="text-sm text-muted uppercase tracking-[0.12em]">{card.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4">
                            <div className="rounded-2xl border border-accent/30 bg-card/50 p-4 md:p-6 shadow-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-accent">Rank overview</h2>
                                    <span className="text-xs px-3 py-1 rounded-full border border-accent/40 text-muted">Live</span>
                                </div>
                                {stats?.rankInfo ? (
                                    <RankDisplay rankInfo={stats.rankInfo} showProgressBar size="large" />
                                ) : (
                                    <div className="text-muted">No rank data.</div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-accent/30 bg-card/50 p-4 md:p-6 shadow-lg space-y-3">
                                <h3 className="text-lg font-bold text-accent">Modes breakdown</h3>
                                {statsByMode ? (
                                    <div className="space-y-2">
                                        {Object.values(statsByMode).map(mode => (
                                            <div key={mode.mode} className="flex items-center justify-between rounded-xl border border-accent/20 bg-navy/40 p-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-accent capitalize">{formatModeLabel(mode.mode)}</div>
                                                    <div className="text-xs text-muted">{mode.totalGames} games</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-neon">{mode.wins}W / {mode.losses}L</div>
                                                    <div className="text-xs text-muted">{(mode.winRate || 0).toFixed(1)}% WR</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted">No mode stats yet.</div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-accent/30 bg-card/60 p-4 md:p-6 shadow-lg space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <h3 className="text-lg font-bold text-accent">Recent matches</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={safePage === 0}
                                        onClick={() => setMatchPage((p) => Math.max(0, p - 1))}
                                        className="px-3 py-1 rounded-lg border border-accent/40 text-accent text-xs disabled:opacity-40"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-xs text-muted">{safePage + 1} / {totalMatchPages}</span>
                                    <button
                                        disabled={safePage >= totalMatchPages - 1}
                                        onClick={() => setMatchPage((p) => Math.min(totalMatchPages - 1, p + 1))}
                                        className="px-3 py-1 rounded-lg border border-accent/40 text-accent text-xs disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                            {pagedMatches.length === 0 ? (
                                <div className="text-muted text-sm">No matches yet. Play a game to populate history.</div>
                            ) : (
                                <div className="space-y-2">
                                    {pagedMatches.map((match) => (
                                        <div key={match.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-accent/25 bg-navy/40 p-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                                                    match.result === 'won' ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                                                }`}>
                                                    {match.result === 'won' ? 'W' : 'L'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-accent truncate">vs {match.opponent}</div>
                                                    <div className="text-xs text-muted flex gap-2 flex-wrap">
                                                        <span className="capitalize">{formatModeLabel(match.mode)}</span>
                                                        <span>• {formatDate(match.playedAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <div className={`font-bold ${match.result === 'won' ? 'text-green-300' : 'text-red-300'}`}>{match.score}</div>
                                                {match.pointsChange !== null && match.mode.toLowerCase() === 'ranked' && (
                                                    <div className={`text-xs ${match.pointsChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                        {match.pointsChange >= 0 ? '+' : ''}{match.pointsChange} RP
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-accent/30 bg-card/50 p-4 md:p-6 shadow-lg space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h3 className="text-lg font-bold text-accent">Achievements</h3>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            disabled={safeAchievementPage === 0}
                                            onClick={() => setAchievementPage((p) => Math.max(0, p - 1))}
                                            className="px-3 py-1 rounded-full border border-accent/40 text-accent disabled:opacity-40"
                                        >
                                            Prev
                                        </button>
                                        <span className="text-muted">{safeAchievementPage + 1} / {totalAchievementPages}</span>
                                        <button
                                            disabled={safeAchievementPage >= totalAchievementPages - 1}
                                            onClick={() => setAchievementPage((p) => Math.min(totalAchievementPages - 1, p + 1))}
                                            className="px-3 py-1 rounded-full border border-accent/40 text-accent disabled:opacity-40"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-neon/40 bg-neon/10 p-3">
                                        <div className="text-2xl font-black text-neon">{achievements.filter(a=>a.unlocked).length}</div>
                                        <div className="text-xs text-muted">Unlocked</div>
                                    </div>
                                    <div className="rounded-xl border border-accent/40 bg-card/40 p-3">
                                        <div className="text-2xl font-black text-accent">{achievements.length}</div>
                                        <div className="text-xs text-muted">Total</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-muted mb-1">
                                        <span>Progress</span>
                                        <span className="font-semibold text-accent">{achievementProgress}%</span>
                                    </div>
                                    <div className="h-2 bg-card/40 rounded-full overflow-hidden border border-accent/30">
                                        <div className="h-full bg-gradient-to-r from-neon to-accent" style={{ width: `${achievementProgress}%` }} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {pagedAchievements.map(a => {
                                        const pctRaw = a.target ? Math.round(((a.progress ?? 0) / a.target) * 100) : (a.unlocked ? 100 : 0);
                                        const pct = Math.max(0, Math.min(100, pctRaw));
                                        return (
                                            <div key={a.id} className={`rounded-xl border p-3 ${a.unlocked ? 'border-neon/50 bg-card/30' : 'border-accent/30 bg-card/20'}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-semibold text-accent truncate">{a.name}</div>
                                                    <span className="text-xs text-muted">{pct}%</span>
                                                </div>
                                                <div className="text-xs text-muted mb-2">{a.description}</div>
                                                <div className="h-2 bg-card/40 rounded-full overflow-hidden border border-accent/30">
                                                    <div
                                                        className={`h-full transition-all duration-500 ease-out ${a.unlocked ? 'bg-gradient-to-r from-neon to-accent' : 'bg-gradient-to-r from-accent/60 to-neon/60'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-accent/30 bg-card/50 p-4 md:p-6 shadow-lg space-y-3">
                                <h3 className="text-lg font-bold text-accent">Frequent opponents</h3>
                                {frequentOpponents.length === 0 ? (
                                    <div className="text-muted text-sm">No opponents yet.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {frequentOpponents.slice(0,4).map((opponent, idx) => (
                                            <div key={opponent.username} className="flex items-center justify-between rounded-xl border border-accent/25 bg-navy/40 p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center text-xs font-bold text-neon">#{idx+1}</div>
                                                    <div>
                                                        <div className="font-semibold text-accent">{opponent.username}</div>
                                                        <div className="text-xs text-muted">{opponent.totalGames} games</div>
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs text-muted">
                                                    <div className="font-bold text-neon">{opponent.winRate.toFixed(1)}% WR</div>
                                                    <div><span className="text-green-300">{opponent.wins}W</span> / <span className="text-red-300">{opponent.losses}L</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </PageContainer>
    );
}
