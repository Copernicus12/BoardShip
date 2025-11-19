import { useState, useEffect } from 'react';
import useAuth from "../state/auth";
import PageContainer from "../components/PageContainer";
import RankDisplay from "../components/RankDisplay";
import api from "../utils/api";
import { calculateAchievements, getRarityColor, getRarityGradient, getCategoryIcon } from '../utils/achievements';
import { formatModeLabel } from '../utils/modes';

interface RankInfo {
    rank: string;
    icon: string;
    color: string;
    currentRP: number;
    minRP: number;
    maxRP: number;
    progressToNext: number;
    nextRank: string | null;
    rpToNext: number;
}

interface UserStats {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
    rankInfo: RankInfo;
}

interface Match {
    id: string;
    opponent: string;
    mode: string;
    result: string;
    score: string;
    pointsChange: number | null;
    durationSeconds: number | null;
    playedAt: string;
}

interface ModeStats {
    mode: string;
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
}

interface StatsByMode {
    ranked: ModeStats;
    classic: ModeStats;
    speed: ModeStats;
}

interface FrequentOpponent {
    username: string;
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
}

interface RankProgressPoint {
    timestamp: string;
    rpBefore: number;
    rpAfter: number;
    change: number;
    rank: string;
}

export default function Profile() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'achievements' | 'stats'>('overview');
    const [stats, setStats] = useState<UserStats | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [statsByMode, setStatsByMode] = useState<StatsByMode | null>(null);
    const [frequentOpponents, setFrequentOpponents] = useState<FrequentOpponent[]>([]);
    const [rankHistory, setRankHistory] = useState<RankProgressPoint[]>([]);
    const [matchFilter, setMatchFilter] = useState<'all' | 'ranked' | 'classic' | 'speed'>('all');
    const [loading, setLoading] = useState(true);

    // Extracted fetch function so other pages can request a refresh via localStorage event
    const fetchProfileData = async () => {
        try {
            setLoading(true);
            const [statsResponse, matchesResponse, statsByModeResponse, opponentsResponse, rankHistoryResponse] = await Promise.all([
                api.get('/api/users/stats'),
                api.get('/api/matches/history'),
                api.get('/api/users/stats/by-mode'),
                api.get('/api/users/opponents/frequent'),
                api.get('/api/users/rank-history')
            ]);
            setStats(statsResponse.data);

            // Ensure matches is always an array
            const matchesData = matchesResponse.data;
            setMatches(Array.isArray(matchesData) ? matchesData : []);

            // Set new data
            setStatsByMode(statsByModeResponse.data);
            setFrequentOpponents(Array.isArray(opponentsResponse.data) ? opponentsResponse.data : []);
            setRankHistory(Array.isArray(rankHistoryResponse.data) ? rankHistoryResponse.data : []);
        } catch (error) {
            console.error('Failed to fetch profile data:', error);
            setMatches([]); // Set empty array on error
            setFrequentOpponents([]);
            setRankHistory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            void fetchProfileData();
        }

        // Listen to localStorage 'profile:refresh' events to reload profile after game ends
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'profile:refresh') {
                void fetchProfileData();
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [user]);

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

    return (
        <PageContainer>
            <div className="max-w-7xl mx-auto px-2 lg:px-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-neon text-xl lg:text-2xl">Loading...</div>
                    </div>
                ) : (
                    <>
                        {/* Profile Header - Responsive */}
                        <div className="bg-card/30 backdrop-blur-xl border border-accent/30 rounded-lg lg:rounded-2xl p-2 lg:p-8 mb-2 lg:mb-6 shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-neon/5 to-accent/5"></div>

                            <div className="relative flex items-center lg:items-start justify-between gap-2 lg:gap-6">
                                <div className="flex items-center gap-2 lg:gap-6 flex-1 min-w-0">
                                    {/* Avatar - Small on mobile, large on desktop */}
                                    <div className="relative flex-shrink-0">
                                        <div className="hidden lg:block absolute -inset-1 bg-gradient-to-r from-neon to-accent rounded-full blur opacity-75"></div>
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=0b1220&color=00b4d8&size=256&bold=true`}
                                            alt="avatar"
                                            className="relative w-12 lg:w-32 h-12 lg:h-32 rounded-full border-2 lg:border-4 border-neon shadow-lg lg:shadow-2xl lg:shadow-neon/50"
                                        />
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-sm lg:text-4xl font-black text-neon lg:text-transparent lg:bg-clip-text lg:bg-gradient-to-r lg:from-neon lg:via-cyan lg:to-accent mb-0.5 lg:mb-2 truncate">
                                            {user?.username || 'Guest'}
                                        </h1>
                                        <p className="hidden lg:block text-muted mb-3 truncate">{user?.email || 'No email provided'}</p>
                                        {stats?.rankInfo && (
                                            <div className="flex gap-1 lg:gap-3 flex-wrap">
                                                <span className="px-1.5 lg:px-4 py-0.5 lg:py-1 bg-neon/20 border lg:border-2 border-neon rounded lg:rounded-full text-neon font-bold text-xs lg:text-sm">
                                                    <span className="hidden lg:inline">{stats.rankInfo.icon} </span>{stats.rankInfo.rank}
                                                </span>
                                                <span className="px-1.5 lg:px-4 py-0.5 lg:py-1 bg-accent/20 border lg:border-2 border-accent rounded lg:rounded-full text-accent font-bold text-xs lg:text-sm">
                                                    <span className="hidden lg:inline">💎 </span>{stats.rankInfo.currentRP} RP
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Logout Button */}
                                <button
                                    onClick={logout}
                                    className="flex-shrink-0 px-2 lg:px-6 py-1 lg:py-3 bg-red-500/20 border lg:border-2 border-red-500/50 text-red-400 rounded lg:rounded-xl hover:bg-red-500/30 hover:border-red-500 transition font-bold text-xs lg:text-base"
                                >
                                    <span className="lg:hidden">Exit</span>
                                    <span className="hidden lg:inline">Logout</span>
                                </button>
                            </div>
                        </div>

                        {/* Stats Grid - Responsive */}
                        {stats && (
                            <div className="grid grid-cols-4 gap-1.5 lg:gap-4 mb-2 lg:mb-6">
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded lg:rounded-xl p-1.5 lg:p-4 text-center hover:border-neon/50 transition hover:scale-105">
                                    <div className="hidden lg:block text-sm text-muted mb-1 font-semibold">🎮</div>
                                    <div className="text-base lg:text-4xl font-black text-neon lg:mb-1">{stats.totalGames || 0}</div>
                                    <div className="text-xs lg:text-sm text-muted font-semibold">
                                        <span className="lg:hidden">Games</span>
                                        <span className="hidden lg:inline">Total Games</span>
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded lg:rounded-xl p-1.5 lg:p-4 text-center hover:border-green-500/50 transition hover:scale-105">
                                    <div className="hidden lg:block text-sm text-muted mb-1 font-semibold">📈</div>
                                    <div className="text-base lg:text-4xl font-black text-green-400 lg:mb-1">{(stats.winRate ?? 0).toFixed(0)}<span className="hidden lg:inline">.{((stats.winRate ?? 0) % 1).toFixed(1).substring(2)}</span>%</div>
                                    <div className="text-xs lg:text-sm text-muted font-semibold">
                                        <span className="lg:hidden">Win</span>
                                        <span className="hidden lg:inline">Win Rate</span>
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded lg:rounded-xl p-1.5 lg:p-4 text-center hover:border-orange-500/50 transition hover:scale-105">
                                    <div className="hidden lg:block text-sm text-muted mb-1 font-semibold">🔥</div>
                                    <div className="text-base lg:text-4xl font-black text-orange-400 lg:mb-1">{stats.bestStreak || 0}</div>
                                    <div className="text-xs lg:text-sm text-muted font-semibold">
                                        <span className="lg:hidden">Streak</span>
                                        <span className="hidden lg:inline">Best Streak</span>
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded lg:rounded-xl p-1.5 lg:p-4 text-center hover:border-accent/50 transition hover:scale-105">
                                    <div className="hidden lg:block text-sm text-muted mb-1 font-semibold">🏆</div>
                                    <div className="text-base lg:text-4xl font-black text-accent lg:mb-1">{stats.wins || 0}</div>
                                    <div className="text-xs lg:text-sm text-muted font-semibold">Wins</div>
                                </div>
                            </div>
                        )}

                        {/* Tabs - Responsive: Icons on mobile, Full text on desktop */}
                        <div className="bg-card/30 backdrop-blur-xl border border-accent/30 rounded-lg lg:rounded-2xl overflow-hidden shadow-xl">
                            <div className="overflow-x-auto scrollbar-hide">
                                <div className="flex border-b border-accent/30">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={`flex-1 min-w-[70px] lg:min-w-0 px-2 lg:px-6 py-2 lg:py-4 font-bold text-xs lg:text-base transition ${
                                            activeTab === 'overview'
                                                ? 'bg-neon/20 text-neon border-b-2 lg:border-b-4 border-neon'
                                                : 'text-muted hover:text-accent hover:bg-accent/5'
                                        }`}
                                    >
                                        <span className="lg:hidden">📊</span>
                                        <span className="hidden lg:inline">📊 Overview</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('matches')}
                                        className={`flex-1 min-w-[70px] lg:min-w-0 px-2 lg:px-6 py-2 lg:py-4 font-bold text-xs lg:text-base transition ${
                                            activeTab === 'matches'
                                                ? 'bg-neon/20 text-neon border-b-2 lg:border-b-4 border-neon'
                                                : 'text-muted hover:text-accent hover:bg-accent/5'
                                        }`}
                                    >
                                        <span className="lg:hidden">⚔️</span>
                                        <span className="hidden lg:inline">⚔️ Match History</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('achievements')}
                                        className={`flex-1 min-w-[70px] lg:min-w-0 px-2 lg:px-6 py-2 lg:py-4 font-bold text-xs lg:text-base transition ${
                                            activeTab === 'achievements'
                                                ? 'bg-neon/20 text-neon border-b-2 lg:border-b-4 border-neon'
                                                : 'text-muted hover:text-accent hover:bg-accent/5'
                                        }`}
                                    >
                                        <span className="lg:hidden">🏅</span>
                                        <span className="hidden lg:inline">🏅 Achievements</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('stats')}
                                        className={`flex-1 min-w-[70px] lg:min-w-0 px-2 lg:px-6 py-2 lg:py-4 font-bold text-xs lg:text-base transition ${
                                            activeTab === 'stats'
                                                ? 'bg-neon/20 text-neon border-b-2 lg:border-b-4 border-neon'
                                                : 'text-muted hover:text-accent hover:bg-accent/5'
                                        }`}
                                    >
                                        <span className="lg:hidden">📈</span>
                                        <span className="hidden lg:inline">📈 Detailed Stats</span>
                                    </button>
                                </div>
                            </div>


                            <div className="p-2 sm:p-4 md:p-6">
                                {activeTab === 'overview' && stats && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                                        <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 hover:border-neon/50 transition shadow-lg">
                                            <h3 className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon to-accent mb-3 sm:mb-4 flex items-center gap-2">
                                                <span>📊</span> Statistics
                                            </h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center p-2 sm:p-3 bg-gradient-to-r from-green-500/10 to-transparent border-l-2 sm:border-l-4 border-green-500 rounded-lg">
                                                    <span className="text-xs sm:text-sm text-muted font-semibold">🏆 Wins</span>
                                                    <span className="text-sm sm:text-base md:text-lg text-green-400 font-black">{stats.wins || 0}</span>
                                                </div>
                                                <div className="flex justify-between items-center p-2 sm:p-3 bg-gradient-to-r from-red-500/10 to-transparent border-l-2 sm:border-l-4 border-red-500 rounded-lg">
                                                    <span className="text-xs sm:text-sm text-muted font-semibold">💀 Losses</span>
                                                    <span className="text-sm sm:text-base md:text-lg text-red-400 font-black">{stats.losses || 0}</span>
                                                </div>
                                                <div className="flex justify-between items-center p-2 sm:p-3 bg-gradient-to-r from-accent/10 to-transparent border-l-2 sm:border-l-4 border-accent rounded-lg">
                                                    <span className="text-xs sm:text-sm text-muted font-semibold">📈 Win Rate</span>
                                                    <span className="text-sm sm:text-base md:text-lg text-accent font-black">{(stats.winRate ?? 0).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between items-center p-2 sm:p-3 bg-gradient-to-r from-orange-500/10 to-transparent border-l-2 sm:border-l-4 border-orange-500 rounded-lg">
                                                    <span className="text-xs sm:text-sm text-muted font-semibold">🔥 Streak</span>
                                                    <span className="text-sm sm:text-base md:text-lg text-orange-400 font-black">{stats.currentStreak || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 hover:border-neon/50 transition shadow-lg">
                                            <h3 className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-accent mb-3 sm:mb-4 flex items-center gap-2">
                                                <span>👑</span> Rank
                                            </h3>
                                            {stats?.rankInfo ? (
                                                <RankDisplay rankInfo={stats.rankInfo} showProgressBar={true} size="medium" />
                                            ) : (
                                                <div className="bg-navy/50 rounded-lg p-6 text-center">
                                                    <div className="text-muted">Loading...</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'matches' && (
                                    <div className="space-y-4">
                                        {/* Filter Buttons - Responsive */}
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { value: 'all', label: 'All', icon: '🎮' },
                                                { value: 'ranked', label: 'Ranked Mode', icon: '🏆' },
                                                { value: 'classic', label: 'Classic', icon: '⚓' },
                                                { value: 'speed', label: 'Speed', icon: '⚡' }
                                            ].map(filter => (
                                                <button
                                                    key={filter.value}
                                                    onClick={() => setMatchFilter(filter.value as any)}
                                                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${
                                                        matchFilter === filter.value
                                                            ? 'bg-gradient-to-r from-neon to-accent text-navy border-2 border-neon shadow-lg shadow-neon/30 scale-105'
                                                            : 'bg-card/40 text-muted border border-accent/30 hover:border-neon/50 hover:text-accent'
                                                    }`}
                                                >
                                                    <span className="hidden sm:inline">{filter.icon} </span>{filter.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Matches List */}
                                        {!Array.isArray(matches) || matches.length === 0 ? (
                                            <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-2xl p-8 sm:p-12 text-center">
                                                <div className="text-5xl sm:text-6xl mb-4">⚔️</div>
                                                <div className="text-lg sm:text-xl text-muted font-semibold mb-2">No Battles Yet</div>
                                                <div className="text-sm text-muted">Start playing to see your epic battle history!</div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 sm:space-y-3">
                                                {matches
                                                    .filter(match => matchFilter === 'all' || match.mode.toLowerCase() === matchFilter)
                                                    .slice(0, 10)
                                                    .map((match) => (
                                                    <div
                                                        key={match.id}
                                                        className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-neon/50 transition-all duration-300 hover:scale-[1.02] shadow-lg"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 sm:gap-4">
                                                            {/* Result Icon */}
                                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black border-2 ${
                                                                match.result === 'won'
                                                                    ? 'bg-green-500/20 border-green-500 text-green-400 shadow-lg shadow-green-500/30'
                                                                    : 'bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/30'
                                                            }`}>
                                                                {match.result === 'won' ? '✓' : '✗'}
                                                            </div>

                                                            {/* Match Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-sm sm:text-base text-accent truncate">
                                                                    vs {match.opponent}
                                                                </div>
                                                                <div className="text-xs sm:text-sm text-muted flex items-center gap-2 flex-wrap">
                                                                    <span className={`px-2 py-0.5 rounded-full ${
                                                                        match.mode.toLowerCase() === 'ranked' ? 'bg-purple-500/20 text-purple-400' :
                                                                        match.mode.toLowerCase() === 'speed' ? 'bg-orange-500/20 text-orange-400' :
                                                                        'bg-blue-500/20 text-blue-400'
                                                                    }`}>
                                                                        {formatModeLabel(match.mode)}
                                                                    </span>
                                                                    <span className="hidden sm:inline">•</span>
                                                                    <span className="hidden sm:inline">{formatDate(match.playedAt)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Score & RP */}
                                                            <div className="text-right">
                                                                <div className={`font-black text-base sm:text-lg ${
                                                                    match.result === 'won' ? 'text-green-400' : 'text-red-400'
                                                                }`}>
                                                                    {match.score}
                                                                </div>
                                                                {match.pointsChange !== null && match.mode.toLowerCase() === 'ranked' && (
                                                                    <div className={`text-xs sm:text-sm font-bold ${
                                                                        match.pointsChange >= 0 ? 'text-green-400' : 'text-red-400'
                                                                    }`}>
                                                                        {match.pointsChange >= 0 ? '+' : ''}{match.pointsChange} RP
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'achievements' && (
                                    <div>
                                        {/* Achievement Stats - Mobile Responsive */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                                            <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-neon/30 p-3 sm:p-4 text-center hover:scale-105 transition-transform">
                                                <div className="text-2xl sm:text-3xl font-black text-neon mb-1">
                                                    {achievements.filter(a => a.unlocked).length}
                                                </div>
                                                <div className="text-xs sm:text-sm text-muted font-semibold">Unlocked</div>
                                            </div>
                                            <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-accent/30 p-3 sm:p-4 text-center hover:scale-105 transition-transform">
                                                <div className="text-2xl sm:text-3xl font-black text-accent mb-1">
                                                    {achievements.length}
                                                </div>
                                                <div className="text-xs sm:text-sm text-muted font-semibold">Total</div>
                                            </div>
                                            <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-yellow-500/30 p-3 sm:p-4 text-center hover:scale-105 transition-transform">
                                                <div className="text-2xl sm:text-3xl font-black text-yellow-400 mb-1">
                                                    {achievements.filter(a => a.unlocked && a.rarity === 'legendary').length}
                                                </div>
                                                <div className="text-xs sm:text-sm text-muted font-semibold">Legendary</div>
                                            </div>
                                            <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-green-500/30 p-3 sm:p-4 text-center hover:scale-105 transition-transform">
                                                <div className="text-2xl sm:text-3xl font-black text-green-400 mb-1">
                                                    {Math.round((achievements.filter(a => a.unlocked).length / achievements.length) * 100)}%
                                                </div>
                                                <div className="text-xs sm:text-sm text-muted font-semibold">Complete</div>
                                            </div>
                                        </div>

                                        {/* Achievements Grid - Mobile Responsive */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                            {achievements.map((achievement) => (
                                                <div
                                                    key={achievement.id}
                                                    className={`relative p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 ${
                                                        achievement.unlocked
                                                            ? `bg-gradient-to-br ${getRarityGradient(achievement.rarity)}/20 ${getRarityColor(achievement.rarity)} hover:scale-[1.02] shadow-lg`
                                                            : 'bg-card/30 border-accent/30 opacity-60 hover:opacity-80'
                                                    }`}
                                                >
                                                    {/* Rarity Badge */}
                                                    {achievement.unlocked && (
                                                        <div className={`absolute top-2 right-2 px-2 py-0.5 sm:py-1 rounded-full text-xs font-black uppercase ${getRarityColor(achievement.rarity)} bg-navy/90 shadow-lg`}>
                                                            {achievement.rarity}
                                                        </div>
                                                    )}

                                                    <div className="flex items-start gap-3 sm:gap-4">
                                                        <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform ${achievement.unlocked ? 'animate-bounce' : 'grayscale opacity-50'}`}>
                                                            {achievement.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className={`font-black text-base sm:text-lg truncate ${
                                                                    achievement.unlocked ? getRarityColor(achievement.rarity).split(' ')[0] : 'text-muted'
                                                                }`}>
                                                                    {achievement.name}
                                                                </h4>
                                                            </div>
                                                            <p className="text-xs sm:text-sm text-muted mb-2">{achievement.description}</p>

                                                            {/* Progress Bar for locked achievements */}
                                                            {!achievement.unlocked && achievement.progress !== undefined && achievement.target !== undefined && (
                                                                <div className="mt-2 sm:mt-3">
                                                                    <div className="flex justify-between text-xs text-muted mb-1">
                                                                        <span className="font-semibold">Progress</span>
                                                                        <span className="font-bold">{achievement.progress} / {achievement.target}</span>
                                                                    </div>
                                                                    <div className="h-2 bg-navy rounded-full overflow-hidden border border-accent/30">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-accent to-neon transition-all duration-500"
                                                                            style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {achievement.unlocked && (
                                                            <div className="text-green-400 text-2xl sm:text-3xl">✓</div>
                                                        )}
                                                    </div>

                                                    {/* Category Tag */}
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <span className="text-xs px-2 py-1 bg-accent/20 rounded-full text-accent font-bold">
                                                            {getCategoryIcon(achievement.category)} {achievement.category.toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'stats' && (
                                    <div className="space-y-6">
                                        {/* Stats by Mode */}
                                        <div>
                                            <h3 className="text-2xl font-bold text-neon mb-4">📊 Stats by Mode</h3>
                                            {statsByMode ? (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {[statsByMode.ranked, statsByMode.classic, statsByMode.speed].map((modeStats) => (
                                                        <div key={modeStats.mode} className="bg-navy/50 border border-accent/30 rounded-xl p-6 hover:border-neon/50 transition">
                                                            <h4 className="text-xl font-bold text-accent mb-4">{modeStats.mode}</h4>
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted">Total Games</span>
                                                                    <span className="font-bold text-white">{modeStats.totalGames}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted">Wins</span>
                                                                    <span className="font-bold text-green-400">{modeStats.wins}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted">Losses</span>
                                                                    <span className="font-bold text-red-400">{modeStats.losses}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted">Win Rate</span>
                                                                    <span className="font-bold text-neon">{modeStats.winRate.toFixed(1)}%</span>
                                                                </div>
                                                                <div className="mt-3 h-2 bg-navy rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-gradient-to-r from-green-400 to-neon transition-all duration-500"
                                                                        style={{ width: `${modeStats.winRate}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center text-muted py-8">Loading stats...</div>
                                            )}
                                        </div>

                                        {/* Frequent Opponents */}
                                        <div>
                                            <h3 className="text-2xl font-bold text-neon mb-4">🎯 Frequent Opponents</h3>
                                            {frequentOpponents.length > 0 ? (
                                                <div className="space-y-3">
                                                    {frequentOpponents.map((opponent, index) => (
                                                        <div
                                                            key={opponent.username}
                                                            className="flex items-center justify-between p-4 bg-navy/50 border border-accent/30 rounded-lg hover:border-neon/50 transition"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center font-bold text-xl text-neon">
                                                                    #{index + 1}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-accent text-lg">{opponent.username}</div>
                                                                    <div className="text-sm text-muted">
                                                                        {opponent.totalGames} {opponent.totalGames === 1 ? 'match' : 'matches'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-lg text-neon mb-1">
                                                                    {opponent.winRate.toFixed(1)}% WR
                                                                </div>
                                                                <div className="text-sm text-muted">
                                                                    <span className="text-green-400">{opponent.wins}W</span>
                                                                    {' - '}
                                                                    <span className="text-red-400">{opponent.losses}L</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center text-muted py-8">
                                                    No opponents yet. Start playing to see your most frequent rivals!
                                                </div>
                                            )}
                                        </div>

                                        {/* Rank Progression */}
                                        <div>
                                            <h3 className="text-2xl font-bold text-neon mb-4">📈 Rank Progression</h3>
                                            {rankHistory.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="text-sm text-muted mb-3">
                                                        Showing last {Math.min(rankHistory.length, 10)} ranked matches
                                                    </div>
                                                    {rankHistory.slice(-10).reverse().map((point, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between p-3 bg-navy/50 border border-accent/30 rounded-lg hover:border-neon/50 transition"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                                                                    point.change >= 0
                                                                        ? 'bg-green-500/20 border border-green-500/50'
                                                                        : 'bg-red-500/20 border border-red-500/50'
                                                                }`}>
                                                                    {point.change >= 0 ? '↑' : '↓'}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-accent">{point.rank}</div>
                                                                    <div className="text-xs text-muted">
                                                                        {new Date(point.timestamp).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-lg text-white">
                                                                    {point.rpBefore} → {point.rpAfter}
                                                                </div>
                                                                <div className={`text-sm font-semibold ${
                                                                    point.change >= 0 ? 'text-green-400' : 'text-red-400'
                                                                }`}>
                                                                    {point.change >= 0 ? '+' : ''}{point.change} RP
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center text-muted py-8">
                                                    No ranked matches yet. Play ranked games to track your progression!
                                                </div>
                                            )}
                                        </div>
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