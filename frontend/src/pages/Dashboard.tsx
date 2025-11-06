import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from "../components/PageContainer";
import api from '../utils/api';
import useAuth from '../state/auth';
import { calculateAchievements, getRarityColor, getRarityGradient } from '../utils/achievements';

type MatchOutcome = 'won' | 'lost' | 'draw';

type RecentMatchResponse = {
    id?: string | null;
    opponent?: string | null;
    mode?: string | null;
    result?: string | null;
    score?: string | null;
    pointsChange?: number | null;
    durationSeconds?: number | null;
    playedAt?: string | null;
};

type RecentMatch = {
    id: string;
    opponent: string;
    mode: string;
    result: MatchOutcome;
    score: string;
    pointsChange: number | null;
    durationSeconds: number | null;
    playedAt: string | null;
};

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
    rankInfo?: RankInfo;
};

const fallbackMatches: RecentMatch[] = [
    {
        id: 'demo-1',
        opponent: 'SeaWolf',
        mode: 'Ranked',
        result: 'won',
        score: '10-7',
        pointsChange: 24,
        durationSeconds: 12 * 60 + 34,
        playedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'demo-2',
        opponent: 'CaptainBlue',
        mode: 'Classic',
        result: 'won',
        score: '10-5',
        pointsChange: 18,
        durationSeconds: 10 * 60 + 52,
        playedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'demo-3',
        opponent: 'NavyKing',
        mode: 'Speed',
        result: 'lost',
        score: '8-10',
        pointsChange: -12,
        durationSeconds: 8 * 60 + 11,
        playedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
        id: 'demo-4',
        opponent: 'Admiral99',
        mode: 'Ranked',
        result: 'won',
        score: '10-6',
        pointsChange: 21,
        durationSeconds: 11 * 60 + 5,
        playedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    },
];

function normalizeResult(result?: string | null): MatchOutcome {
    const normalized = result?.toLowerCase();
    if (normalized === 'lost' || normalized === 'loss' || normalized === 'defeat') {
        return 'lost';
    }
    if (normalized === 'draw' || normalized === 'tie') {
        return 'draw';
    }
    return 'won';
}

function mapMatchResponse(match: RecentMatchResponse, index: number): RecentMatch {
    return {
        id: match.id ?? `${match.opponent ?? 'opponent'}-${match.playedAt ?? index}`,
        opponent: match.opponent ?? 'Unknown',
        mode: match.mode ?? 'Classic',
        result: normalizeResult(match.result),
        score: match.score ?? '—',
        pointsChange: typeof match.pointsChange === 'number' ? match.pointsChange : null,
        durationSeconds: typeof match.durationSeconds === 'number' ? match.durationSeconds : null,
        playedAt: match.playedAt ?? null,
    };
}

function formatDuration(seconds?: number | null): string | null {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
        return null;
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);

    if (mins === 0) {
        return `${secs}s`;
    }
    if (secs === 0) {
        return `${mins}m`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function formatRelativeTime(isoDate?: string | null): string {
    if (!isoDate) return 'Recently';

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Recently';

    const diffMs = date.getTime() - Date.now();
    const thresholds: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
        { limit: 60, divisor: 1, unit: 'second' },
        { limit: 60 * 60, divisor: 60, unit: 'minute' },
        { limit: 60 * 60 * 24, divisor: 60 * 60, unit: 'hour' },
        { limit: 60 * 60 * 24 * 7, divisor: 60 * 60 * 24, unit: 'day' },
        { limit: 60 * 60 * 24 * 30, divisor: 60 * 60 * 24 * 7, unit: 'week' },
        { limit: 60 * 60 * 24 * 365, divisor: 60 * 60 * 24 * 30, unit: 'month' },
        { limit: Infinity, divisor: 60 * 60 * 24 * 365, unit: 'year' },
    ];

    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const diffSeconds = Math.round(diffMs / 1000);
    const absSeconds = Math.abs(diffSeconds);

    for (const { limit, divisor, unit } of thresholds) {
        if (absSeconds < limit) {
            const value = Math.round(diffSeconds / divisor);
            return formatter.format(value, unit);
        }
    }

    return formatter.format(Math.round(diffSeconds / (60 * 60 * 24 * 365)), 'year');
}

export default function Dashboard() {
    const user = useAuth((state) => state.user);
    const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);
    const [stats, setStats] = useState<UserStats>({
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        currentStreak: 0,
        bestStreak: 0,
    });
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        let active = true;

        async function loadMatches() {
            setLoadingMatches(true);
            try {
                const { data } = await api.get<RecentMatchResponse[]>('/api/matches/recent?limit=5');
                if (!active) return;

                if (Array.isArray(data) && data.length > 0) {
                    const normalized = data.map((match, index) => mapMatchResponse(match, index));
                    setRecentMatches(normalized);
                } else {
                    setRecentMatches([]);
                }
                setMatchesError(null);
            } catch (error) {
                if (!active) return;
                setMatchesError('Could not load recent matches — showing sample data for now.');
                setRecentMatches(fallbackMatches);
            } finally {
                if (active) {
                    setLoadingMatches(false);
                }
            }
        }

        loadMatches();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        async function loadStats() {
            setLoadingStats(true);
            try {
                const { data } = await api.get<UserStats>('/api/users/stats');
                if (!active) return;

                setStats(data);
            } catch (error) {
                if (!active) return;
                console.error('Could not load user stats:', error);
                // Keep default stats on error
            } finally {
                if (active) {
                    setLoadingStats(false);
                }
            }
        }

        loadStats();
        return () => {
            active = false;
        };
    }, []);

    // Calculate achievements based on stats
    const achievements = stats ? calculateAchievements({
        totalGames: stats.totalGames,
        wins: stats.wins,
        losses: stats.losses,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        winRate: stats.winRate,
        rank: stats.rankInfo?.rank,
    }) : [];

    // Get recently unlocked achievements (last 3 unlocked)
    const recentAchievements = achievements
        .filter(a => a.unlocked)
        .slice(0, 3);

    return (
        <PageContainer>
            <div className="max-w-7xl mx-auto">
                {/* Welcome Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-neon mb-2">
                        Welcome back, {user?.username || 'Captain'}!
                    </h1>
                    <p className="text-muted">Here's your battle performance overview</p>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Total Games</div>
                        {loadingStats ? (
                            <div className="h-9 flex items-center">
                                <div className="h-6 w-16 animate-pulse rounded bg-accent/20"></div>
                            </div>
                        ) : (
                            <div className="text-3xl font-bold text-neon mb-1">{stats.totalGames}</div>
                        )}
                        <div className="text-xs text-accent">All time</div>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Win Rate</div>
                        {loadingStats ? (
                            <div className="h-9 flex items-center">
                                <div className="h-6 w-16 animate-pulse rounded bg-accent/20"></div>
                            </div>
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-green-400 mb-1">
                                    {stats.winRate.toFixed(0)}%
                                </div>
                                <div className="text-xs text-accent">{stats.wins}W - {stats.losses}L</div>
                            </>
                        )}
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Current Streak</div>
                        {loadingStats ? (
                            <div className="h-9 flex items-center">
                                <div className="h-6 w-16 animate-pulse rounded bg-accent/20"></div>
                            </div>
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-neon mb-1">🔥 {stats.currentStreak}</div>
                                <div className="text-xs text-accent">Best: {stats.bestStreak}</div>
                            </>
                        )}
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Rank</div>
                        {loadingStats ? (
                            <div className="h-9 flex items-center">
                                <div className="h-6 w-16 animate-pulse rounded bg-accent/20"></div>
                            </div>
                        ) : stats.rankInfo ? (
                            <>
                                <div className="text-3xl font-bold text-neon mb-1 flex items-center gap-2">
                                    <span>{stats.rankInfo.icon}</span>
                                    <span>{stats.rankInfo.rank}</span>
                                </div>
                                <div className="text-xs text-accent">{stats.rankInfo.currentRP} RP</div>
                            </>
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-neon mb-1">🥉 Bronze</div>
                                <div className="text-xs text-accent">0 RP</div>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Matches */}
                    <div className="lg:col-span-2 bg-card border border-accent rounded-xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-accent">Recent Matches</h2>
                            <Link to="/profile" className="text-neon hover:underline text-sm">
                                View All →
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {loadingMatches ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-10">
                                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
                                    <p className="text-sm text-muted">Loading recent matches...</p>
                                </div>
                            ) : recentMatches.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-accent/40 bg-navy/40 p-6 text-center text-muted">
                                    No matches yet. Time to launch a battle!
                                </div>
                            ) : (
                                recentMatches.map((match) => {
                                    const isWin = match.result === 'won';
                                    const isLoss = match.result === 'lost';

                                    const badgeClass = isWin
                                        ? 'bg-green-500/20 border border-green-500/50'
                                        : isLoss
                                            ? 'bg-red-500/20 border border-red-500/50'
                                            : 'bg-accent/20 border border-accent/50';
                                    const badgeIcon = isWin ? '✓' : isLoss ? '✗' : '≡';
                                    const scoreClass = isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-accent';
                                    const resultLabel = isWin ? 'Victory' : isLoss ? 'Defeat' : 'Draw';

                                    const durationLabel = formatDuration(match.durationSeconds);
                                    const relativeTime = formatRelativeTime(match.playedAt);
                                    const metaSegments = [`${match.mode} Mode`];
                                    if (durationLabel) metaSegments.push(durationLabel);
                                    if (relativeTime) metaSegments.push(relativeTime);
                                    const metaLine = metaSegments.join(' • ');

                                    const points = match.pointsChange;
                                    const hasPoints = typeof points === 'number' && !Number.isNaN(points);
                                    const pointsClass = !hasPoints
                                        ? 'text-muted'
                                        : points > 0
                                            ? 'text-green-400'
                                            : points < 0
                                                ? 'text-red-400'
                                                : 'text-accent';
                                    const pointsLabel = hasPoints ? `${points > 0 ? '+' : ''}${points} RP` : null;

                                    return (
                                        <div
                                            key={match.id}
                                            className="flex items-center justify-between rounded-lg border border-accent/30 bg-navy/50 p-4 transition hover:border-neon/50"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${badgeClass}`}>
                                                    {badgeIcon}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-accent">vs {match.opponent}</div>
                                                    <div className="text-sm text-muted">{metaLine}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold ${scoreClass}`}>{match.score}</div>
                                                <div className="text-xs text-muted">{resultLabel}</div>
                                                {pointsLabel && (
                                                    <div className={`text-xs font-semibold ${pointsClass}`}>
                                                        {pointsLabel}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {matchesError && (
                            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-300">
                                ⚠️ {matchesError}
                            </div>
                        )}
                    </div>

                    {/* Achievements & Quick Actions */}
                    <div className="space-y-6">
                        {/* Rank Progress */}
                        {stats.rankInfo && !loadingStats && (
                            <div className="bg-card border border-accent rounded-xl p-6">
                                <h3 className="text-xl font-bold text-accent mb-4">Rank Progress</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-3xl">{stats.rankInfo.icon}</span>
                                            <div>
                                                <div className="font-bold text-neon">{stats.rankInfo.rank}</div>
                                                <div className="text-xs text-muted">{stats.rankInfo.currentRP} RP</div>
                                            </div>
                                        </div>
                                        {stats.rankInfo.nextRank && (
                                            <div className="text-right">
                                                <div className="text-xs text-muted">Next Rank</div>
                                                <div className="text-sm font-semibold text-accent">{stats.rankInfo.nextRank}</div>
                                                <div className="text-xs text-muted">{stats.rankInfo.rpToNext} RP to go</div>
                                            </div>
                                        )}
                                    </div>
                                    {stats.rankInfo.nextRank && (
                                        <div>
                                            <div className="flex justify-between text-xs text-muted mb-1">
                                                <span>{stats.rankInfo.minRP} RP</span>
                                                <span>{stats.rankInfo.progressToNext}%</span>
                                                <span>{stats.rankInfo.maxRP} RP</span>
                                            </div>
                                            <div className="h-2 bg-navy rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-accent to-neon transition-all duration-500"
                                                    style={{ width: `${stats.rankInfo.progressToNext}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Recent Achievements */}
                        <div className="bg-card border border-accent rounded-xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-accent">Recent Achievements</h3>
                                <Link to="/profile" className="text-neon hover:underline text-xs">
                                    View All →
                                </Link>
                            </div>
                            {recentAchievements.length > 0 ? (
                                <div className="space-y-3">
                                    {recentAchievements.map((achievement) => (
                                        <div
                                            key={achievement.id}
                                            className={`flex items-center gap-3 p-3 bg-gradient-to-r ${getRarityGradient(achievement.rarity)}/20 border ${getRarityColor(achievement.rarity)} rounded-lg hover:scale-105 transition-transform`}
                                        >
                                            <div className="text-3xl">{achievement.icon}</div>
                                            <div className="flex-1">
                                                <div className={`font-semibold text-sm ${getRarityColor(achievement.rarity).split(' ')[0]}`}>
                                                    {achievement.name}
                                                </div>
                                                <div className="text-xs text-muted">{achievement.description}</div>
                                            </div>
                                            <div className="text-green-400 text-xl">✓</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="text-4xl mb-2 opacity-50">🏆</div>
                                    <p className="text-muted text-sm">Play games to unlock achievements!</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-card border border-accent rounded-xl p-6">
                            <h3 className="text-xl font-bold text-accent mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <Link
                                    to="/lobby"
                                    className="block w-full px-4 py-3 bg-neon text-navy font-bold rounded-lg hover:opacity-90 transition text-center"
                                >   Play Now
                                </Link>
                                <Link
                                    to="/leaderboard"
                                    className="block w-full px-4 py-3 bg-navy border border-accent text-accent font-semibold rounded-lg hover:border-neon hover:text-neon transition text-center"
                                >   Leaderboard
                                </Link>
                                <Link
                                    to="/profile"
                                    className="block w-full px-4 py-3 bg-navy border border-accent text-accent font-semibold rounded-lg hover:border-neon hover:text-neon transition text-center"
                                >   My Profile
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}
