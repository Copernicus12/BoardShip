import { useState, useEffect } from 'react';
import useAuth from "../state/auth";
import PageContainer from "../components/PageContainer";
import RankDisplay from "../components/RankDisplay";
import api from "../utils/api";
import { calculateAchievements, getRarityColor, getRarityGradient, getCategoryIcon, type Achievement } from '../utils/achievements';

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
    playerUsername: string;
    opponentUsername: string;
    mode: string;
    result: string;
    score: string;
    pointsChange: number | null;
    playedAt: string;
}

export default function Profile() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'achievements'>('overview');
    const [stats, setStats] = useState<UserStats | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsResponse, matchesResponse] = await Promise.all([
                    api.get('/users/stats'),
                    api.get('/matches/history')
                ]);
                setStats(statsResponse.data);
                setMatches(matchesResponse.data || []);
            } catch (error) {
                console.error('Failed to fetch profile data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
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
            <div className="max-w-6xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-neon text-2xl">Loading...</div>
                    </div>
                ) : (
                    <>
                        {/* Profile Header */}
                        <div className="bg-card border border-accent rounded-xl p-8 mb-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=0b1220&color=00b4d8&size=128`}
                                            alt="avatar"
                                            className="w-32 h-32 rounded-full border-4 border-neon shadow-glow"
                                        />
                                    </div>
                                    <div>
                                        <h1 className="text-4xl font-bold text-neon mb-2">{user?.username || 'Guest'}</h1>
                                        <p className="text-muted mb-3">{user?.email || 'No email provided'}</p>
                                        {stats?.rankInfo && (
                                            <div className="flex gap-3">
                                                <span className="px-4 py-1 bg-neon/20 border border-neon rounded-full text-neon font-semibold text-sm">
                                                    {stats.rankInfo.rank}
                                                </span>
                                                <span className="px-4 py-1 bg-accent/20 border border-accent rounded-full text-accent font-semibold text-sm">
                                                    {stats.rankInfo.currentRP} RP
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        {stats && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                                    <div className="text-3xl font-bold text-neon mb-1">{stats.totalGames || 0}</div>
                                    <div className="text-sm text-muted">Total Games</div>
                                </div>
                                <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                                    <div className="text-3xl font-bold text-green-400 mb-1">{(stats.winRate ?? 0).toFixed(1)}%</div>
                                    <div className="text-sm text-muted">Win Rate</div>
                                </div>
                                <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                                    <div className="text-3xl font-bold text-neon mb-1">{stats.bestStreak || 0}</div>
                                    <div className="text-sm text-muted">Best Streak</div>
                                </div>
                                <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                                    <div className="text-3xl font-bold text-accent mb-1">{stats.wins || 0}</div>
                                    <div className="text-sm text-muted">Wins</div>
                                </div>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="bg-card border border-accent rounded-xl overflow-hidden">
                            <div className="flex border-b border-accent">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`flex-1 px-6 py-4 font-semibold transition ${
                                        activeTab === 'overview'
                                            ? 'bg-accent/10 text-neon border-b-2 border-neon'
                                            : 'text-muted hover:text-accent'
                                    }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab('matches')}
                                    className={`flex-1 px-6 py-4 font-semibold transition ${
                                        activeTab === 'matches'
                                            ? 'bg-accent/10 text-neon border-b-2 border-neon'
                                            : 'text-muted hover:text-accent'
                                    }`}
                                >
                                    Match History
                                </button>
                                <button
                                    onClick={() => setActiveTab('achievements')}
                                    className={`flex-1 px-6 py-4 font-semibold transition ${
                                        activeTab === 'achievements'
                                            ? 'bg-accent/10 text-neon border-b-2 border-neon'
                                            : 'text-muted hover:text-accent'
                                    }`}
                                >
                                    Achievements
                                </button>
                            </div>

                            <div className="p-6">
                                {activeTab === 'overview' && stats && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-accent mb-4">Game Statistics</h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                                    <span className="text-muted">Wins</span>
                                                    <span className="text-green-400 font-semibold">{stats.wins || 0}</span>
                                                </div>
                                                <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                                    <span className="text-muted">Losses</span>
                                                    <span className="text-red-400 font-semibold">{stats.losses || 0}</span>
                                                </div>
                                                <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                                    <span className="text-muted">Win Rate</span>
                                                    <span className="text-accent font-semibold">{(stats.winRate ?? 0).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                                    <span className="text-muted">Current Streak</span>
                                                    <span className="text-neon font-semibold">🔥 {stats.currentStreak || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-bold text-accent mb-4">Rank Progress</h3>
                                            {stats?.rankInfo ? (
                                                <RankDisplay rankInfo={stats.rankInfo} showProgressBar={true} size="medium" />
                                            ) : (
                                                <div className="bg-navy/50 rounded-lg p-6 text-center">
                                                    <div className="text-muted">Loading rank information...</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'matches' && (
                                    <div className="space-y-3">
                                        {matches.length === 0 ? (
                                            <div className="text-center text-muted py-8">
                                                No matches played yet. Start playing to see your match history!
                                            </div>
                                        ) : (
                                            matches.slice(0, 10).map((match) => (
                                                <div
                                                    key={match.id}
                                                    className="flex items-center justify-between p-4 bg-navy/50 border border-accent/30 rounded-lg hover:border-neon/50 transition"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                                                            match.result === 'won'
                                                                ? 'bg-green-500/20 border border-green-500/50'
                                                                : 'bg-red-500/20 border border-red-500/50'
                                                        }`}>
                                                            {match.result === 'won' ? '✓' : '✗'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-accent">vs {match.opponentUsername}</div>
                                                            <div className="text-sm text-muted">{match.mode} • {formatDate(match.playedAt)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-bold text-lg ${
                                                            match.result === 'won' ? 'text-green-400' : 'text-red-400'
                                                        }`}>
                                                            {match.score}
                                                        </div>
                                                        {match.pointsChange !== null && match.mode.toLowerCase() === 'ranked' && (
                                                            <div className={`text-sm font-semibold ${
                                                                match.pointsChange >= 0 ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                                {match.pointsChange >= 0 ? '+' : ''}{match.pointsChange} RP
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {activeTab === 'achievements' && (
                                    <div>
                                        {/* Achievement Stats */}
                                        <div className="grid grid-cols-4 gap-4 mb-6">
                                            <div className="bg-navy/50 rounded-lg p-4 border border-accent/30 text-center">
                                                <div className="text-3xl font-bold text-neon mb-1">
                                                    {achievements.filter(a => a.unlocked).length}
                                                </div>
                                                <div className="text-xs text-muted">Unlocked</div>
                                            </div>
                                            <div className="bg-navy/50 rounded-lg p-4 border border-accent/30 text-center">
                                                <div className="text-3xl font-bold text-accent mb-1">
                                                    {achievements.length}
                                                </div>
                                                <div className="text-xs text-muted">Total</div>
                                            </div>
                                            <div className="bg-navy/50 rounded-lg p-4 border border-accent/30 text-center">
                                                <div className="text-3xl font-bold text-yellow-400 mb-1">
                                                    {achievements.filter(a => a.unlocked && a.rarity === 'legendary').length}
                                                </div>
                                                <div className="text-xs text-muted">Legendary</div>
                                            </div>
                                            <div className="bg-navy/50 rounded-lg p-4 border border-accent/30 text-center">
                                                <div className="text-3xl font-bold text-green-400 mb-1">
                                                    {Math.round((achievements.filter(a => a.unlocked).length / achievements.length) * 100)}%
                                                </div>
                                                <div className="text-xs text-muted">Complete</div>
                                            </div>
                                        </div>

                                        {/* Achievements Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {achievements.map((achievement) => (
                                                <div
                                                    key={achievement.id}
                                                    className={`relative p-5 rounded-xl border-2 transition-all duration-300 ${
                                                        achievement.unlocked
                                                            ? `bg-gradient-to-br ${getRarityGradient(achievement.rarity)}/20 ${getRarityColor(achievement.rarity)} hover:scale-105 hover:shadow-lg`
                                                            : 'bg-navy/30 border-accent/30 opacity-60 hover:opacity-80'
                                                    }`}
                                                >
                                                    {/* Rarity Badge */}
                                                    {achievement.unlocked && (
                                                        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold uppercase ${getRarityColor(achievement.rarity)} bg-navy/80`}>
                                                            {achievement.rarity}
                                                        </div>
                                                    )}

                                                    <div className="flex items-start gap-4">
                                                        <div className={`text-5xl transition-transform ${achievement.unlocked ? 'animate-bounce' : 'grayscale'}`}>
                                                            {achievement.icon}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className={`font-bold text-lg ${
                                                                    achievement.unlocked ? getRarityColor(achievement.rarity).split(' ')[0] : 'text-muted'
                                                                }`}>
                                                                    {achievement.name}
                                                                </h4>
                                                            </div>
                                                            <p className="text-sm text-muted mb-2">{achievement.description}</p>

                                                            {/* Progress Bar for locked achievements */}
                                                            {!achievement.unlocked && achievement.progress !== undefined && achievement.target !== undefined && (
                                                                <div className="mt-3">
                                                                    <div className="flex justify-between text-xs text-muted mb-1">
                                                                        <span>Progress</span>
                                                                        <span>{achievement.progress} / {achievement.target}</span>
                                                                    </div>
                                                                    <div className="h-2 bg-navy rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-accent to-neon transition-all duration-500"
                                                                            style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {achievement.unlocked && (
                                                            <div className="text-green-400 text-3xl">✓</div>
                                                        )}
                                                    </div>

                                                    {/* Category Tag */}
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <span className="text-xs px-2 py-1 bg-accent/20 rounded-full text-accent font-semibold">
                                                            {getCategoryIcon(achievement.category)} {achievement.category.toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
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