import { useState } from 'react';
import useAuth from "../state/auth";
import PageContainer from "../components/PageContainer";

export default function Profile() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'achievements'>('overview');

    // Mock data - replace with real API calls later
    const stats = {
        level: 24,
        experience: 68,
        totalGames: 156,
        wins: 98,
        losses: 58,
        draws: 0,
        winRate: 62.8,
        avgScore: 8.4,
        bestStreak: 15,
        currentStreak: 3,
        totalPlayTime: '47h 23m',
        rank: 'Gold II',
        division: 3,
        rankPoints: 2458
    };

    const achievements = [
        { id: 1, name: 'First Blood', description: 'Win your first game', icon: '🎯', unlocked: true },
        { id: 2, name: 'Winning Streak', description: 'Win 5 games in a row', icon: '🔥', unlocked: true },
        { id: 3, name: 'Sharp Shooter', description: 'Hit 100 shots', icon: '🎯', unlocked: true },
        { id: 4, name: 'Admiral', description: 'Reach Gold rank', icon: '⚓', unlocked: true },
        { id: 5, name: 'Legendary', description: 'Win 100 games', icon: '👑', unlocked: false },
        { id: 6, name: 'Perfect Game', description: 'Win without getting hit', icon: '💯', unlocked: false },
    ];

    const matchHistory = [
        { id: 1, date: '2 hours ago', opponent: 'SeaWolf', result: 'won', score: '10-7', mode: 'Ranked', points: '+24' },
        { id: 2, date: '5 hours ago', opponent: 'CaptainBlue', result: 'won', score: '10-5', mode: 'Classic', points: '+18' },
        { id: 3, date: 'Yesterday', opponent: 'NavyKing', result: 'lost', score: '8-10', mode: 'Speed', points: '-12' },
        { id: 4, date: 'Yesterday', opponent: 'Admiral99', result: 'won', score: '10-6', mode: 'Ranked', points: '+21' },
        { id: 5, date: '2 days ago', opponent: 'Battleship_Pro', result: 'won', score: '10-3', mode: 'Classic', points: '+15' },
    ];

    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto">
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
                                <div className="absolute -bottom-2 -right-2 bg-neon text-navy font-bold px-3 py-1 rounded-full text-sm">
                                    Lv {stats.level}
                                </div>
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-neon mb-2">{user?.username || 'Guest'}</h1>
                                <p className="text-muted mb-3">{user?.email || 'No email provided'}</p>
                                <div className="flex gap-3">
                                    <span className="px-4 py-1 bg-neon/20 border border-neon rounded-full text-neon font-semibold text-sm">
                                        {stats.rank}
                                    </span>
                                    <span className="px-4 py-1 bg-accent/20 border border-accent rounded-full text-accent font-semibold text-sm">
                                        {stats.rankPoints} RP
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition"
                        >
                            Logout
                        </button>
                    </div>

                    {/* XP Bar */}
                    <div className="mt-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted">Level Progress</span>
                            <span className="text-accent">{stats.experience}%</span>
                        </div>
                        <div className="w-full bg-navy rounded-full h-3 border border-accent">
                            <div
                                className="bg-gradient-to-r from-neon to-accent h-full rounded-full transition-all shadow-glow"
                                style={{ width: `${stats.experience}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                        <div className="text-3xl font-bold text-neon mb-1">{stats.totalGames}</div>
                        <div className="text-sm text-muted">Total Games</div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                        <div className="text-3xl font-bold text-green-400 mb-1">{stats.winRate}%</div>
                        <div className="text-sm text-muted">Win Rate</div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                        <div className="text-3xl font-bold text-neon mb-1">{stats.bestStreak}</div>
                        <div className="text-sm text-muted">Best Streak</div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4 text-center hover:border-neon transition">
                        <div className="text-3xl font-bold text-accent mb-1">{stats.totalPlayTime}</div>
                        <div className="text-sm text-muted">Play Time</div>
                    </div>
                </div>

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
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-xl font-bold text-accent mb-4">Game Statistics</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                            <span className="text-muted">Wins</span>
                                            <span className="text-green-400 font-semibold">{stats.wins}</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                            <span className="text-muted">Losses</span>
                                            <span className="text-red-400 font-semibold">{stats.losses}</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                            <span className="text-muted">Avg. Score</span>
                                            <span className="text-accent font-semibold">{stats.avgScore}</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-navy/50 rounded-lg">
                                            <span className="text-muted">Current Streak</span>
                                            <span className="text-neon font-semibold">🔥 {stats.currentStreak}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold text-accent mb-4">Rank Progress</h3>
                                    <div className="bg-navy/50 rounded-lg p-6 text-center">
                                        <div className="text-5xl mb-3">⚓</div>
                                        <div className="text-2xl font-bold text-neon mb-2">{stats.rank}</div>
                                        <div className="text-muted mb-4">Division {stats.division}</div>
                                        <div className="text-3xl font-bold text-accent">{stats.rankPoints} RP</div>
                                        <div className="text-sm text-muted mt-2">542 RP to Platinum</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'matches' && (
                            <div className="space-y-3">
                                {matchHistory.map((match) => (
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
                                                <div className="font-semibold text-accent">vs {match.opponent}</div>
                                                <div className="text-sm text-muted">{match.mode} • {match.date}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold text-lg ${
                                                match.result === 'won' ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {match.score}
                                            </div>
                                            <div className={`text-sm font-semibold ${
                                                match.points.startsWith('+') ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {match.points} RP
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'achievements' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {achievements.map((achievement) => (
                                    <div
                                        key={achievement.id}
                                        className={`p-5 rounded-lg border transition ${
                                            achievement.unlocked
                                                ? 'bg-accent/5 border-neon/50 hover:border-neon'
                                                : 'bg-navy/30 border-accent/30 opacity-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-5xl">{achievement.icon}</div>
                                            <div className="flex-1">
                                                <h4 className={`font-bold text-lg mb-1 ${
                                                    achievement.unlocked ? 'text-neon' : 'text-muted'
                                                }`}>
                                                    {achievement.name}
                                                </h4>
                                                <p className="text-sm text-muted">{achievement.description}</p>
                                            </div>
                                            {achievement.unlocked && (
                                                <div className="text-green-400 text-2xl">✓</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}