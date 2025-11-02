import { Link } from 'react-router-dom';
import PageContainer from "../components/PageContainer";
import useAuth from '../state/auth';

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
                        Welcome to BoardShip
                    </h1>
                    {user && (
                        <p className="text-2xl text-accent mb-6">
                            Hello, <span className="text-neon">{user.username}</span>!
                        </p>
                    )}
                    <p className="text-lg text-muted max-w-2xl mx-auto mb-8">
                        Challenge players worldwide in epic naval battles. Sink enemy ships,
                        climb the leaderboard, and become the ultimate fleet commander!
                    </p>

                    <div className="flex gap-4 justify-center">
                        <Link
                            to="/lobby"
                            className="px-8 py-3 bg-neon hover:opacity-90 text-navy font-bold rounded-lg transition shadow-glow"
                        >
                            Join Battle
                        </Link>
                        <Link
                            to="/leaderboard"
                            className="px-8 py-3 bg-card border border-accent hover:border-neon text-accent hover:text-neon font-bold rounded-lg transition"
                        >
                            View Rankings
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">1,234</div>
                    <div className="text-sm text-muted">Active Players</div>
                </div>
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">56</div>
                    <div className="text-sm text-muted">Games in Progress</div>
                </div>
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">8,921</div>
                    <div className="text-sm text-muted">Battles Today</div>
                </div>
                <div className="bg-card border border-accent rounded-xl p-6 text-center hover:border-neon transition">
                    <div className="text-3xl font-bold text-neon mb-1">342</div>
                    <div className="text-sm text-muted">Online Now</div>
                </div>
            </div>

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
                    {mockMatches.map((match) => (
                        <div
                            key={match.id}
                            className="bg-card border border-accent rounded-xl p-5 hover:border-neon transition-all hover:shadow-glow group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-accent group-hover:text-neon transition">
                                        {match.game}
                                    </h3>
                                    <p className="text-sm text-muted">vs {match.opponent}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    match.result === 'won' 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                }`}>
                                    {match.result.toUpperCase()}
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <div className="flex gap-4">
                                    <div>
                                        <span className="text-muted">Score: </span>
                                        <span className="text-accent font-semibold">{match.score}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted">Duration: </span>
                                        <span className="text-accent font-semibold">{match.duration}</span>
                                    </div>
                                </div>
                                <div className="text-muted text-xs">{match.date}</div>
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
                        <div className="text-4xl mb-3">⚓</div>
                        <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2">
                            Classic Mode
                        </h3>
                        <p className="text-muted text-sm mb-4">
                            Traditional battleship rules. Take turns and sink all enemy ships to win.
                        </p>
                        <Link
                            to="/lobby"
                            className="inline-block text-neon hover:underline text-sm font-semibold"
                        >
                            Play Now →
                        </Link>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon hover:shadow-glow transition-all group">
                        <div className="text-4xl mb-3">⚡</div>
                        <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2">
                            Speed Battle
                        </h3>
                        <p className="text-muted text-sm mb-4">
                            Fast-paced action with time limits. Quick decisions and faster gameplay.
                        </p>
                        <Link
                            to="/lobby"
                            className="inline-block text-neon hover:underline text-sm font-semibold"
                        >
                            Play Now →
                        </Link>
                    </div>

                    <div className="bg-card border border-accent rounded-xl p-6 hover:border-neon hover:shadow-glow transition-all group">
                        <div className="text-4xl mb-3">🎯</div>
                        <h3 className="text-xl font-bold text-accent group-hover:text-neon transition mb-2">
                            Ranked Mode
                        </h3>
                        <p className="text-muted text-sm mb-4">
                            Compete for glory and climb the leaderboard. Earn points and rank up.
                        </p>
                        <Link
                            to="/lobby"
                            className="inline-block text-neon hover:underline text-sm font-semibold"
                        >
                            Play Now →
                        </Link>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}