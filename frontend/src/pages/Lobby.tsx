import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from "../components/PageContainer";

// Mock data for game rooms - replace with real API calls later
const mockRooms = [
    {
        id: 1,
        name: 'Quick Match #1',
        host: 'Player_123',
        mode: 'Classic',
        players: '1/2',
        status: 'waiting'
    },
    {
        id: 2,
        name: 'Pro League Battle',
        host: 'ProGamer99',
        mode: 'Ranked',
        players: '1/2',
        status: 'waiting'
    },
    {
        id: 3,
        name: 'Speed Challenge',
        host: 'FastShooter',
        mode: 'Speed Battle',
        players: '2/2',
        status: 'in-progress'
    },
    {
        id: 4,
        name: 'Beginners Welcome',
        host: 'NewCaptain',
        mode: 'Classic',
        players: '1/2',
        status: 'waiting'
    },
];

export default function Lobby() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [gameName, setGameName] = useState('');
    const [gameMode, setGameMode] = useState('classic');
    const navigate = useNavigate();

    const handleCreateGame = () => {
        // TODO: Implement actual game creation
        console.log('Creating game:', { gameName, gameMode });
        setShowCreateModal(false);
        navigate('/game');
    };

    const handleJoinGame = (roomId: number) => {
        // TODO: Implement actual join game logic
        console.log('Joining room:', roomId);
        navigate('/game');
    };

    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-neon mb-2">Game Lobby</h1>
                        <p className="text-muted">Join a game or create your own battle</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-neon hover:opacity-90 text-navy font-bold rounded-lg transition shadow-glow"
                    >
                        + Create Game
                    </button>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-card border border-accent rounded-lg p-4">
                        <div className="text-sm text-muted mb-1">Available Games</div>
                        <div className="text-2xl font-bold text-neon">
                            {mockRooms.filter(r => r.status === 'waiting').length}
                        </div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4">
                        <div className="text-sm text-muted mb-1">Players Online</div>
                        <div className="text-2xl font-bold text-neon">342</div>
                    </div>
                    <div className="bg-card border border-accent rounded-lg p-4">
                        <div className="text-sm text-muted mb-1">Games in Progress</div>
                        <div className="text-2xl font-bold text-neon">
                            {mockRooms.filter(r => r.status === 'in-progress').length}
                        </div>
                    </div>
                </div>

                {/* Game Rooms List */}
                <div className="bg-card border border-accent rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-accent mb-6">Available Rooms</h2>

                    <div className="space-y-3">
                        {mockRooms.map((room) => (
                            <div
                                key={room.id}
                                className="bg-navy border border-accent rounded-lg p-5 hover:border-neon transition-all group flex items-center justify-between"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-accent group-hover:text-neon transition">
                                            {room.name}
                                        </h3>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            room.status === 'waiting'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                        }`}>
                                            {room.status === 'waiting' ? 'WAITING' : 'IN PROGRESS'}
                                        </span>
                                    </div>
                                    <div className="flex gap-6 text-sm text-muted">
                                        <div>
                                            <span className="text-muted">Host: </span>
                                            <span className="text-accent">{room.host}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted">Mode: </span>
                                            <span className="text-accent">{room.mode}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted">Players: </span>
                                            <span className="text-accent">{room.players}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleJoinGame(room.id)}
                                    disabled={room.status === 'in-progress'}
                                    className={`px-6 py-2 rounded-lg font-semibold transition ${
                                        room.status === 'waiting'
                                            ? 'bg-neon text-navy hover:opacity-90'
                                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    {room.status === 'waiting' ? 'Join' : 'Full'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Create Game Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-accent rounded-xl p-8 max-w-md w-full relative">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-4 right-4 text-muted hover:text-neon text-2xl"
                        >
                            ×
                        </button>

                        <h2 className="text-2xl font-bold text-neon mb-6">Create New Game</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-accent text-sm font-semibold mb-2">
                                    Game Name
                                </label>
                                <input
                                    type="text"
                                    value={gameName}
                                    onChange={(e) => setGameName(e.target.value)}
                                    placeholder="Enter game name..."
                                    className="w-full px-4 py-2 bg-navy border border-accent rounded-lg text-accent focus:border-neon outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-accent text-sm font-semibold mb-2">
                                    Game Mode
                                </label>
                                <select
                                    value={gameMode}
                                    onChange={(e) => setGameMode(e.target.value)}
                                    className="w-full px-4 py-2 bg-navy border border-accent rounded-lg text-accent focus:border-neon outline-none transition"
                                >
                                    <option value="classic">Classic Mode</option>
                                    <option value="speed">Speed Battle</option>
                                    <option value="ranked">Ranked Mode</option>
                                </select>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 bg-navy border border-accent text-accent rounded-lg hover:border-neon transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateGame}
                                    disabled={!gameName.trim()}
                                    className="flex-1 px-4 py-2 bg-neon text-navy font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}