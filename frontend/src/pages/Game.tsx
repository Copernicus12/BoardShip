import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useAuth from '../state/auth';
import GameBoard3D from '../components/GameBoard3D';
import ShipPlacement from '../components/ShipPlacement';
import { Client as StompClient } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

type GamePhase = 'waiting' | 'placement' | 'ready' | 'playing' | 'finished';

type PlacedShip = {
    id: string;
    name: string;
    size: number;
    positions: Array<{ row: number; col: number }>;
    orientation: 'horizontal' | 'vertical';
};

// Prefer an explicit WS endpoint from env; otherwise fall back to a same-origin `/ws`
// path so local dev can rely on the Vite proxy and production can use the backend host.
const WS_ENDPOINT = import.meta.env.VITE_WS_URL ?? '/ws';

export default function Game() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isHost, setIsHost] = useState(false);
    const isHostRef = useRef(false);
    const hostLeaveIntentRef = useRef(false);
    const lobbyDeletedRef = useRef(false);
    const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [opponentConnected, setOpponentConnected] = useState(false);
    const [myShips, setMyShips] = useState<PlacedShip[]>([]);
    const [opponentReady, setOpponentReady] = useState(false);
    const [myAttacks, setMyAttacks] = useState<Array<{row: number, col: number, isHit: boolean}>>([]);
    const [opponentAttacks, setOpponentAttacks] = useState<Array<{row: number, col: number, isHit: boolean}>>([]);
    const [winner, setWinner] = useState<string | null>(null);
    const stompClientRef = useRef<StompClient | null>(null);

    const deleteLobbyIfHost = useCallback(async () => {
        if (!isHostRef.current || !roomId || lobbyDeletedRef.current) {
            return;
        }

        try {
            await api.delete(`/api/lobbies/${roomId}`);
            lobbyDeletedRef.current = true;
            console.log('Game: host deleted lobby intentionally', { roomId });
        } catch (error) {
            console.error('Failed to delete lobby', error);
        }
    }, [roomId]);

    useEffect(() => {
        if (!roomId) return;

        let mounted = true;

        const load = async () => {
            try {
                const res = await api.get(`/api/lobbies/${roomId}`);
                const lobby = res.data;
                const userIsHost = lobby.hostId && user && lobby.hostId === user.id;
                console.log('Game: lobby loaded', { lobbyId: roomId, lobbyHostId: lobby.hostId, userId: user?.id, isHost: userIsHost });

                if (mounted) {
                    setIsHost(userIsHost);
                    isHostRef.current = userIsHost;

                    // Check if there are 2 players
                    if (lobby.currentPlayers >= 2) {
                        setOpponentConnected(true);
                        setGamePhase('placement');
                    } else {
                        setGamePhase('waiting');
                    }
                }
            } catch (e) {
                console.warn('Lobby not found or error', e);
                navigate('/lobby');
            }
        };

        load();

        // WebSocket connection for real-time updates
        const client = new StompClient({
            webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
            reconnectDelay: 3000,
        });

        client.onConnect = () => {
            console.log('Game WebSocket connected');

            // Subscribe to game-specific updates
            client.subscribe(`/topic/game/${roomId}`, (msg: IMessage) => {
                try {
                    const payload = JSON.parse(msg.body);
                    console.log('Game update:', payload);

                    if (payload.type === 'PLAYER_JOINED') {
                        console.log('🎮 Player joined the game');
                        setOpponentConnected(true);
                        setGamePhase('placement');
                    } else if (payload.type === 'PLAYER_READY') {
                        console.log('✓ Opponent is ready!', payload);
                        setOpponentReady(true);
                    } else if (payload.type === 'GAME_START') {
                        console.log('🚀 Game starting!', payload);
                        setGamePhase('playing');
                        setIsMyTurn(payload.firstPlayer === user?.id);
                    } else if (payload.type === 'ATTACK') {
                        // Handle attack (from me or opponent)
                        console.log('💥 Attack:', payload);
                        const attack = {
                            row: payload.row,
                            col: payload.col,
                            isHit: payload.isHit
                        };

                        // Check if this attack is from me or opponent
                        if (payload.playerId === user?.id) {
                            // My attack on enemy board
                            console.log(payload.isHit ? '🎯 I HIT!' : '💧 I MISSED');
                            setMyAttacks(prev => [...prev, attack]);
                        } else {
                            // Opponent's attack on my board
                            console.log(payload.isHit ? '💥 Opponent HIT my ship!' : '🌊 Opponent MISSED');
                            setOpponentAttacks(prev => [...prev, attack]);
                        }
                    } else if (payload.type === 'TURN_CHANGE') {
                        console.log('🔄 Turn changed (after MISS):', payload);
                        const isMyNewTurn = payload.currentPlayer === user?.id;
                        console.log(`It's now ${isMyNewTurn ? 'MY' : "OPPONENT'S"} turn`);
                        setIsMyTurn(isMyNewTurn);
                    } else if (payload.type === 'TURN_KEEP') {
                        console.log('🎯 HIT! Keep the turn:', payload);
                        const stillMyTurn = payload.currentPlayer === user?.id;
                        console.log(`It's still ${stillMyTurn ? 'MY' : "OPPONENT'S"} turn - they can attack again!`);
                        setIsMyTurn(stillMyTurn);
                    } else if (payload.type === 'GAME_OVER') {
                        console.log('🏆 GAME OVER!', payload);
                        setGamePhase('finished');
                        setWinner(payload.winner);
                        setIsMyTurn(false);
                    }
                } catch (e) {
                    console.error('Invalid game update', e);
                }
            });

            // Subscribe to lobby updates to detect player joins
            client.subscribe('/topic/lobbies', (msg: IMessage) => {
                try {
                    const payload = JSON.parse(msg.body);
                    if (payload.id === roomId && payload.currentPlayers >= 2) {
                        setOpponentConnected(true);
                        setGamePhase(prev => (prev === 'waiting' ? 'placement' : prev));
                    }
                } catch (e) {
                    console.error('Invalid lobby update', e);
                }
            });
        };

        client.activate();
        stompClientRef.current = client;

        return () => {
            mounted = false;
            console.log('Game: unmount cleanup', { isHost: isHostRef.current, roomId });

            try {
                client?.deactivate();
            } catch (e) {
                console.error('Error deactivating WebSocket', e);
            }

            if (hostLeaveIntentRef.current) {
                void deleteLobbyIfHost();
            }
        };
    }, [roomId, user, navigate, deleteLobbyIfHost]);

    const handleLeaveToLobby = useCallback(async () => {
        hostLeaveIntentRef.current = true;

        try {
            await deleteLobbyIfHost();
        } finally {
            navigate('/lobby');
        }
    }, [deleteLobbyIfHost, navigate]);


    const handleShipPlacementComplete = (ships: PlacedShip[]) => {
        setMyShips(ships);
        setGamePhase('ready');

        // Notify server that player is ready
        if (stompClientRef.current && roomId) {
            stompClientRef.current.publish({
                destination: `/app/game/${roomId}/ready`,
                body: JSON.stringify({
                    playerId: user?.id,
                    ships: ships
                })
            });
        }

        console.log('Ships placed, waiting for opponent...', { opponentReady });
    };

    const handleCellClick = (row: number, col: number) => {
        if (!isMyTurn || gamePhase !== 'playing') {
            console.log('❌ Not your turn or game not started', { isMyTurn, gamePhase });
            return;
        }

        console.log(`🎯 Attacking cell: [${row}, ${col}]`);

        // Send attack to server
        if (stompClientRef.current && roomId) {
            stompClientRef.current.publish({
                destination: `/app/game/${roomId}/attack`,
                body: JSON.stringify({
                    playerId: user?.id,
                    row: row,
                    col: col
                })
            });
            console.log('✓ Attack sent to server, waiting for turn change...');
        }

        // Don't manually change turn - wait for backend TURN_CHANGE message
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                        🚢 Battleship - Room {roomId?.substring(0, 8)}
                    </h1>
                    <div className="flex gap-4 items-center text-sm">
                        <span className={`px-3 py-1 rounded-full ${
                            gamePhase === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                            gamePhase === 'placement' ? 'bg-blue-500/20 text-blue-400' :
                            gamePhase === 'ready' ? 'bg-purple-500/20 text-purple-400' :
                            gamePhase === 'finished' ? (winner === user?.id ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400') :
                            isMyTurn ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {gamePhase === 'waiting' && '⏳ Waiting for opponent...'}
                            {gamePhase === 'placement' && '📍 Place your ships'}
                            {gamePhase === 'ready' && '⏰ Waiting for opponent to be ready...'}
                            {gamePhase === 'playing' && (isMyTurn ? '🎯 Your Turn' : '⏳ Opponent\'s Turn')}
                            {gamePhase === 'finished' && (winner === user?.id ? '🏆 Victory!' : '💀 Defeat')}
                        </span>
                        <span className="text-cyan-400">
                            Players: <span className="font-bold">{opponentConnected ? '2/2' : '1/2'}</span>
                        </span>
                        {isHost && (
                            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400">
                                👑 Host
                            </span>
                        )}
                    </div>
                </div>

                {/* Waiting Phase */}
                {gamePhase === 'waiting' && (
                    <div className="bg-slate-800/50 rounded-lg p-12 border border-cyan-500/30 text-center">
                        <div className="text-6xl mb-4">⏳</div>
                        <h2 className="text-3xl font-bold text-cyan-400 mb-3">Waiting for Opponent</h2>
                        <p className="text-gray-300 mb-6">
                            Share this room code with your friend: <span className="font-mono text-cyan-300 text-xl">{roomId?.substring(0, 8)}</span>
                        </p>
                        <div className="flex justify-center gap-3">
                            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                )}

                {/* Placement Phase */}
                {gamePhase === 'placement' && (
                    <div className="max-w-2xl mx-auto">
                        <ShipPlacement onPlacementComplete={handleShipPlacementComplete} />
                    </div>
                )}

                {/* Ready Phase - Waiting for opponent */}
                {gamePhase === 'ready' && (
                    <div className="bg-slate-800/50 rounded-lg p-12 border border-purple-500/30 text-center">
                        <div className="text-6xl mb-4">✓</div>
                        <h2 className="text-3xl font-bold text-purple-400 mb-3">You're Ready!</h2>
                        <p className="text-gray-300 mb-6">
                            Waiting for your opponent to finish placing their ships...
                        </p>
                        <div className="flex justify-center gap-3">
                            <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                            <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                            <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                    </div>
                )}

                {/* Finished Phase - Victory/Defeat Screen */}
                {gamePhase === 'finished' && (
                    <div className={`rounded-lg p-12 border text-center ${
                        winner === user?.id 
                            ? 'bg-green-900/30 border-green-500/50' 
                            : 'bg-red-900/30 border-red-500/50'
                    }`}>
                        <div className="text-8xl mb-6">
                            {winner === user?.id ? '🏆' : '💀'}
                        </div>
                        <h2 className={`text-5xl font-bold mb-4 ${
                            winner === user?.id ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {winner === user?.id ? 'VICTORY!' : 'DEFEAT'}
                        </h2>
                        <p className="text-gray-300 text-xl mb-8">
                            {winner === user?.id
                                ? '🎯 You destroyed all enemy ships!'
                                : '💥 All your ships were destroyed!'}
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleLeaveToLobby}
                                className="px-8 py-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg border border-cyan-500/50 transition-all text-lg font-semibold"
                            >
                                Return to Lobby
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/50 transition-all text-lg font-semibold"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Playing Phase - Game Boards */}
                {gamePhase === 'playing' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Your Board */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                                <span>🛡️</span> Your Fleet
                            </h2>
                            <GameBoard3D
                                isPlayerBoard={true}
                                boardSize={10}
                                initialShips={myShips.map(ship => ({
                                    ...ship,
                                    hits: 0
                                }))}
                                attacks={opponentAttacks}
                            />
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Your Ships</h3>
                                <div className="space-y-2 text-sm">
                                    {myShips.map(ship => (
                                        <div key={ship.id} className="flex justify-between items-center">
                                            <span className="text-gray-300">🚢 {ship.name} ({ship.size})</span>
                                            <span className="text-green-400">
                                                {Array.from({ length: ship.size }).map((_, i) => (
                                                    <span key={i}>● </span>
                                                ))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Opponent's Board */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
                                <span>🎯</span> Enemy Waters
                            </h2>
                            <GameBoard3D
                                isPlayerBoard={false}
                                boardSize={10}
                                onCellClick={handleCellClick}
                                isClickable={isMyTurn}
                                initialShips={[]}
                                attacks={myAttacks}
                            />
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-red-500/30">
                                <h3 className="text-lg font-semibold text-red-300 mb-2">Attack Stats</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-gray-400">Hits</div>
                                        <div className="text-2xl font-bold text-red-400">
                                            {myAttacks.filter(a => a.isHit).length}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400">Misses</div>
                                        <div className="text-2xl font-bold text-blue-400">
                                            {myAttacks.filter(a => !a.isHit).length}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Controls */}
                {(gamePhase === 'playing' || gamePhase === 'ready') && (
                    <div className="mt-6 bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                        <div className="flex justify-between items-center">
                            <div className="text-gray-300 text-sm">
                                💡 <span className="font-semibold">Tip:</span> Click on enemy waters to attack. Rotate the camera using mouse drag.
                            </div>
                            <button
                                onClick={handleLeaveToLobby}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/50 transition-all"
                            >
                                Leave Game
                            </button>
                        </div>
                    </div>
                )}

                {/* Leave button for waiting phase */}
                {gamePhase === 'waiting' && (
                    <div className="mt-6 text-center">
                        <button
                            onClick={handleLeaveToLobby}
                            className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/50 transition-all"
                        >
                            Cancel & Leave
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
