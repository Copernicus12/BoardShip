import { Link } from 'react-router-dom';
import PageContainer from "../components/PageContainer";
import useAuth from '../state/auth';

export default function Dashboard() {
    const user = useAuth((state) => state.user);

    // Mock user stats - replace with real data later
    const stats = {
        totalGames: 47,
        wins: 32,
        losses: 15,
        winRate: 68,
        currentStreak: 5,
        bestStreak: 12,
        rank: 'Gold II',
        points: 2458
    };

    const recentAchievements = [
        { id: 1, name: 'First Victory', icon: '🏆', date: 'Today' },
        { id: 2, name: 'Winning Streak', icon: '🔥', date: 'Yesterday' },
        { id: 3, name: 'Sharp Shooter', icon: '🎯', date: '2 days ago' },
    ];

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
                        <div className="text-3xl font-bold text-neon mb-1">{stats.totalGames}</div>
                        <div className="text-xs text-accent">All time</div>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Win Rate</div>
                        <div className="text-3xl font-bold text-green-400 mb-1">{stats.winRate}%</div>
                        <div className="text-xs text-accent">{stats.wins}W - {stats.losses}L</div>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Current Streak</div>
                        <div className="text-3xl font-bold text-neon mb-1">🔥 {stats.currentStreak}</div>
                        <div className="text-xs text-accent">Best: {stats.bestStreak}</div>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon transition">
                        <div className="text-sm text-muted mb-2">Rank</div>
                        <div className="text-3xl font-bold text-neon mb-1">{stats.rank}</div>
                        <div className="text-xs text-accent">{stats.points} points</div>
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
                            {[
                                { id: 1, opponent: 'SeaWolf', result: 'won', score: '10-7', mode: 'Ranked' },
                                { id: 2, opponent: 'CaptainBlue', result: 'won', score: '10-5', mode: 'Classic' },
                                { id: 3, opponent: 'NavyKing', result: 'lost', score: '8-10', mode: 'Speed' },
                                { id: 4, opponent: 'Admiral99', result: 'won', score: '10-6', mode: 'Ranked' },
                            ].map((match) => (
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
                                            <div className="text-sm text-muted">{match.mode} Mode</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${
                                            match.result === 'won' ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {match.score}
                                        </div>
                                        <div className="text-xs text-muted">
                                            {match.result === 'won' ? 'Victory' : 'Defeat'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Achievements & Quick Actions */}
                    <div className="space-y-6">
                        {/* Recent Achievements */}
                        <div className="bg-card border border-accent rounded-xl p-6">
                            <h3 className="text-xl font-bold text-accent mb-4">Recent Achievements</h3>
                            <div className="space-y-3">
                                {recentAchievements.map((achievement) => (
                                    <div
                                        key={achievement.id}
                                        className="flex items-center gap-3 p-3 bg-navy/50 border border-accent/30 rounded-lg"
                                    >
                                        <div className="text-3xl">{achievement.icon}</div>
                                        <div>
                                            <div className="font-semibold text-accent text-sm">
                                                {achievement.name}
                                            </div>
                                            <div className="text-xs text-muted">{achievement.date}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-card border border-accent rounded-xl p-6">
                            <h3 className="text-xl font-bold text-accent mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <Link
                                    to="/lobby"
                                    className="block w-full px-4 py-3 bg-neon text-navy font-bold rounded-lg hover:opacity-90 transition text-center"
                                >
                                    ⚔️ Play Now
                                </Link>
                                <Link
                                    to="/leaderboard"
                                    className="block w-full px-4 py-3 bg-navy border border-accent text-accent font-semibold rounded-lg hover:border-neon hover:text-neon transition text-center"
                                >
                                    📊 Leaderboard
                                </Link>
                                <Link
                                    to="/profile"
                                    className="block w-full px-4 py-3 bg-navy border border-accent text-accent font-semibold rounded-lg hover:border-neon hover:text-neon transition text-center"
                                >
                                    👤 My Profile
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}