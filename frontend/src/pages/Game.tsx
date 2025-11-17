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
    const { user, fetchMe } = useAuth();
    const [isHost, setIsHost] = useState(false);
    const isHostRef = useRef(false);
    const lobbyDeletedRef = useRef(false);
    const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [opponentConnected, setOpponentConnected] = useState(false);
    const [myShips, setMyShips] = useState<PlacedShip[]>([]);
    const [opponentReady, setOpponentReady] = useState(false);
    const [myAttacks, setMyAttacks] = useState<Array<{row: number, col: number, isHit: boolean}>>([]);
    const [pendingAttacks, setPendingAttacks] = useState<Array<{row: number, col: number}>>([]);
    const [opponentAttacks, setOpponentAttacks] = useState<Array<{row: number, col: number, isHit: boolean}>>([]);
    const [winner, setWinner] = useState<string | null>(null);
    const [winReason, setWinReason] = useState<string | null>(null);
    const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
    const [gameMode, setGameMode] = useState<string>('classic');
    const [turnTimeLimit, setTurnTimeLimit] = useState<number>(0);
    const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(0);
    const [rpChange, setRpChange] = useState<number | null>(null);
    const stompClientRef = useRef<StompClient | null>(null);
    const gamePhaseRef = useRef<GamePhase>('waiting');

    // Keep gamePhaseRef in sync with gamePhase
    useEffect(() => {
        gamePhaseRef.current = gamePhase;
    }, [gamePhase]);

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
        let gameFinished = false;

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

                        // Check for existing game state
                        try {
                            const gameStateRes = await api.get(`/api/game-state/${roomId}`);
                            const gameState = gameStateRes.data;
                            console.log('Game state loaded:', gameState);

                            // Restore game mode
                            if (gameState.gameMode) {
                                setGameMode(gameState.gameMode);
                                console.log('Restored game mode:', gameState.gameMode);
                            }

                            // Determine which player we are
                            const isPlayer1 = user && gameState.player1Id === user.id;
                            const isPlayer2 = user && gameState.player2Id === user.id;

                            // Check if game is finished
                            if (gameState.gamePhase === 'finished') {
                                gameFinished = true;
                                console.log('Game is finished, staying on game over screen');
                                setGamePhase('finished');
                                setWinner(gameState.winner);
                                setIsMyTurn(false);

                                // Restore win reason and game over message
                                if (gameState.winReason) {
                                    setWinReason(gameState.winReason);
                                    console.log('Restored win reason:', gameState.winReason);
                                }
                                if (gameState.gameOverMessage) {
                                    setGameOverMessage(gameState.gameOverMessage);
                                    console.log('Restored game over message:', gameState.gameOverMessage);
                                }

                                // Restore RP change for ranked games
                                if (gameState.gameMode === 'ranked') {
                                    if (gameState.winner === user?.id && gameState.winnerRpChange !== undefined) {
                                        setRpChange(gameState.winnerRpChange);
                                        console.log('Restored winner RP change:', gameState.winnerRpChange);
                                    } else if (gameState.loser === user?.id && gameState.loserRpChange !== undefined) {
                                        setRpChange(gameState.loserRpChange);
                                        console.log('Restored loser RP change:', gameState.loserRpChange);
                                    }
                                }

                                // Restore all game state for the finished screen
                                if (isPlayer1) {
                                    setMyShips(gameState.player1Ships || []);
                                    setMyAttacks(gameState.player1Attacks || []);
                                    setOpponentAttacks(gameState.player2Attacks || []);
                                } else if (isPlayer2) {
                                    setMyShips(gameState.player2Ships || []);
                                    setMyAttacks(gameState.player2Attacks || []);
                                    setOpponentAttacks(gameState.player1Attacks || []);
                                }
                                setOpponentReady(true);
                                setOpponentConnected(true);
                                if (gameState.gameMode) {
                                    setGameMode(gameState.gameMode);
                                }
                            } else if (isPlayer1 && gameState.player1Ships && gameState.player1Ready) {
                                // Player 1 has already placed ships
                                console.log('Restoring player 1 ships from database');
                                setMyShips(gameState.player1Ships);

                                // Restore my attacks (player 1's attacks on player 2)
                                if (gameState.player1Attacks && Array.isArray(gameState.player1Attacks)) {
                                    console.log('Restoring player 1 attacks:', gameState.player1Attacks);
                                    setMyAttacks(gameState.player1Attacks);
                                }

                                // Restore opponent's attacks (player 2's attacks on player 1)
                                if (gameState.player2Attacks && Array.isArray(gameState.player2Attacks)) {
                                    console.log('Restoring opponent attacks on player 1:', gameState.player2Attacks);
                                    setOpponentAttacks(gameState.player2Attacks);
                                }

                                if (gameState.gamePhase === 'playing') {
                                    setGamePhase('playing');
                                    const isMyCurrentTurn = gameState.currentTurn === user.id;
                                    setIsMyTurn(isMyCurrentTurn);
                                    setOpponentReady(true);

                                    // For speed mode, always set time limit (for display purposes)
                                    if (gameState.gameMode === 'speed') {
                                        setTurnTimeLimit(3);

                                        // Calculate initial remaining time from server timestamp
                                        if (gameState.turnStartedAt) {
                                            const serverTurnStartTime = new Date(gameState.turnStartedAt).getTime();
                                            const now = Date.now();
                                            const elapsedSeconds = Math.floor((now - serverTurnStartTime) / 1000);
                                            const remainingTime = Math.max(0, 3 - elapsedSeconds);
                                            setTurnTimeRemaining(remainingTime);
                                            console.log('Speed mode: Restored timer with', remainingTime, 'seconds remaining (Player 1)');
                                        }
                                    }
                                } else {
                                    setGamePhase('ready');
                                    setOpponentReady(gameState.player2Ready || false);
                                }
                            } else if (isPlayer2 && gameState.player2Ships && gameState.player2Ready) {
                                // Player 2 has already placed ships
                                console.log('Restoring player 2 ships from database');
                                setMyShips(gameState.player2Ships);

                                // Restore my attacks (player 2's attacks on player 1)
                                if (gameState.player2Attacks && Array.isArray(gameState.player2Attacks)) {
                                    console.log('Restoring player 2 attacks:', gameState.player2Attacks);
                                    setMyAttacks(gameState.player2Attacks);
                                }

                                // Restore opponent's attacks (player 1's attacks on player 2)
                                if (gameState.player1Attacks && Array.isArray(gameState.player1Attacks)) {
                                    console.log('Restoring opponent attacks on player 2:', gameState.player1Attacks);
                                    setOpponentAttacks(gameState.player1Attacks);
                                }

                                if (gameState.gamePhase === 'playing') {
                                    setGamePhase('playing');
                                    const isMyCurrentTurn = gameState.currentTurn === user.id;
                                    setIsMyTurn(isMyCurrentTurn);
                                    setOpponentReady(true);

                                    // For speed mode, always set time limit (for display purposes)
                                    if (gameState.gameMode === 'speed') {
                                        setTurnTimeLimit(3);

                                        // Calculate initial remaining time from server timestamp
                                        if (gameState.turnStartedAt) {
                                            const serverTurnStartTime = new Date(gameState.turnStartedAt).getTime();
                                            const now = Date.now();
                                            const elapsedSeconds = Math.floor((now - serverTurnStartTime) / 1000);
                                            const remainingTime = Math.max(0, 3 - elapsedSeconds);
                                            setTurnTimeRemaining(remainingTime);
                                            console.log('Speed mode: Restored timer with', remainingTime, 'seconds remaining (Player 2)');
                                        }
                                    }
                                } else {
                                    setGamePhase('ready');
                                    setOpponentReady(gameState.player1Ready || false);
                                }
                            } else {
                                // No ships placed yet, go to placement
                                setGamePhase('placement');

                                // Check if opponent is ready
                                if (isPlayer1 && gameState.player2Ready) {
                                    setOpponentReady(true);
                                } else if (isPlayer2 && gameState.player1Ready) {
                                    setOpponentReady(true);
                                }
                            }
                        } catch (e) {
                            console.log('No existing game state, starting fresh');
                            setGamePhase('placement');
                        }
                    } else {
                        setGamePhase('waiting');
                    }
                }
            } catch (e) {
                console.warn('Lobby not found or error', e);
                // Only redirect if game is not finished
                // If game is finished, try to load game state even if lobby doesn't exist
                try {
                    const gameStateRes = await api.get(`/api/game-state/${roomId}`);
                    const gameState = gameStateRes.data;
                    if (gameState && gameState.gamePhase === 'finished') {
                        console.log('Lobby deleted but game finished, loading game over screen');
                        gameFinished = true;
                        setGamePhase('finished');
                        setWinner(gameState.winner);
                        setIsMyTurn(false);

                        // Restore win reason and game over message
                        if (gameState.winReason) {
                            setWinReason(gameState.winReason);
                            console.log('Restored win reason:', gameState.winReason);
                        }
                        if (gameState.gameOverMessage) {
                            setGameOverMessage(gameState.gameOverMessage);
                            console.log('Restored game over message:', gameState.gameOverMessage);
                        }

                        // Restore RP change for ranked games
                        if (gameState.gameMode === 'ranked') {
                            if (gameState.winner === user?.id && gameState.winnerRpChange !== undefined) {
                                setRpChange(gameState.winnerRpChange);
                                console.log('Restored winner RP change:', gameState.winnerRpChange);
                            } else if (gameState.loser === user?.id && gameState.loserRpChange !== undefined) {
                                setRpChange(gameState.loserRpChange);
                                console.log('Restored loser RP change:', gameState.loserRpChange);
                            }
                        }

                        const isPlayer1 = user && gameState.player1Id === user.id;
                        const isPlayer2 = user && gameState.player2Id === user.id;
                        if (isPlayer1) {
                            setMyShips(gameState.player1Ships || []);
                            setMyAttacks(gameState.player1Attacks || []);
                            setOpponentAttacks(gameState.player2Attacks || []);
                        } else if (isPlayer2) {
                            setMyShips(gameState.player2Ships || []);
                            setMyAttacks(gameState.player2Attacks || []);
                            setOpponentAttacks(gameState.player1Attacks || []);
                        }
                        setOpponentReady(true);
                        setOpponentConnected(true);
                        if (gameState.gameMode) {
                            setGameMode(gameState.gameMode);
                        }
                    } else {
                        navigate('/lobby');
                    }
                } catch (gameStateError) {
                    console.warn('No game state found either, redirecting to lobby');
                    navigate('/lobby');
                }
            }
        };

        load();

        // WebSocket connection for real-time updates
        // Don't connect if game is already finished
        const client = new StompClient({
            webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
            reconnectDelay: 3000,
        });

        client.onConnect = () => {
            // If game finished during load, disconnect immediately
            if (gameFinished) {
                console.log('🚫 Game is finished, not subscribing to WebSocket updates');
                client.deactivate();
                return;
            }
            console.log('Game WebSocket connected');

            // Subscribe to game-specific updates
            client.subscribe(`/topic/game/${roomId}`, (msg: IMessage) => {
                try {
                    const payload = JSON.parse(msg.body);
                    console.log('Game update:', payload);

                    // Ignore all messages except GAME_OVER if game is already finished
                    if (gamePhaseRef.current === 'finished' && payload.type !== 'GAME_OVER') {
                        console.log('🚫 Ignoring message - game already finished:', payload.type);
                        return;
                    }

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

                        // Set game mode and turn time limit
                        if (payload.gameMode) {
                            setGameMode(payload.gameMode);
                        }
                        if (payload.turnTimeLimit) {
                            setTurnTimeLimit(payload.turnTimeLimit);
                        }
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
                            // Remove from pending if present
                            setPendingAttacks(prev => prev.filter(p => !(p.row === attack.row && p.col === attack.col)));
                            setMyAttacks(prev => [...prev, attack]);
                        } else {
                            // Opponent's attack on my board
                            console.log(payload.isHit ? '💥 Opponent HIT my ship!' : '🌊 Opponent MISSED');
                            setOpponentAttacks(prev => [...prev, attack]);
                        }
                    } else if (payload.type === 'ATTACK_ERROR') {
                        // Handle attack error (e.g., cell already attacked)
                        console.warn('⚠️ Attack error:', payload.message, { row: payload.row, col: payload.col });
                        // If we had this attack pending, remove it so the user can try another cell
                        try {
                            setPendingAttacks(prev => prev.filter(p => !(p.row === payload.row && p.col === payload.col)));
                        } catch (e) {}
                        // Optionally show a toast notification to the user
                        // For now, just log it - the frontend check should prevent this
                    } else if (payload.type === 'TURN_CHANGE') {
                        console.log('🔄 Turn changed (after MISS):', payload);
                        const isMyNewTurn = payload.currentPlayer === user?.id;
                        console.log(`It's now ${isMyNewTurn ? 'MY' : "OPPONENT'S"} turn`);
                        setIsMyTurn(isMyNewTurn);

                        // Reset timer for speed mode
                        if (gameMode === 'speed') {
                            setTurnTimeRemaining(turnTimeLimit || 3);
                        }
                    } else if (payload.type === 'TURN_TIMEOUT') {
                        console.log('⏱️ Turn timeout!', payload);
                        const isMyNewTurn = payload.currentPlayer === user?.id;
                        setIsMyTurn(isMyNewTurn);

                        // Reset timer for speed mode
                        if (gameMode === 'speed') {
                            setTurnTimeRemaining(turnTimeLimit || 3);
                        }
                    } else if (payload.type === 'TURN_KEEP') {
                        const stillMyTurn = payload.currentPlayer === user?.id;
                        console.log(`It's still ${stillMyTurn ? 'MY' : "OPPONENT'S"} turn - they can attack again!`);
                        setIsMyTurn(stillMyTurn);
                    } else if (payload.type === 'GAME_OVER') {
                        console.log('🏆 GAME OVER!', payload);
                        setGamePhase('finished');
                        setWinner(payload.winner);
                        setIsMyTurn(false);

                        // Save win/loss reason
                        if (payload.reason) {
                            setWinReason(payload.reason);
                        }

                        // Save game over message (e.g., "PlayerName left the game")
                        if (payload.message) {
                            setGameOverMessage(payload.message);
                            console.log('Game over message:', payload.message);
                        }

                        // Save RP change for ranked mode
                        if (payload.winner === user?.id && payload.winnerRpChange !== undefined) {
                            console.log('Setting winner RP change:', payload.winnerRpChange);
                            setRpChange(payload.winnerRpChange);
                            // Refresh authenticated user and notify profile to reload
                            try {
                                fetchMe?.().catch(() => {});
                            } catch (e) {
                                // ignore
                            }
                            try { localStorage.setItem('profile:refresh', String(Date.now())); } catch (e) {}
                        } else if (payload.loser === user?.id && payload.loserRpChange !== undefined) {
                            console.log('Setting loser RP change:', payload.loserRpChange);
                            setRpChange(payload.loserRpChange);
                            // Refresh authenticated user and notify profile to reload
                            try {
                                fetchMe?.().catch(() => {});
                            } catch (e) {
                                // ignore
                            }
                            try { localStorage.setItem('profile:refresh', String(Date.now())); } catch (e) {}
                        }

                        // Disconnect WebSocket after a short delay to ensure this message is fully processed
                        setTimeout(() => {
                            try {
                                console.log('🔌 Disconnecting WebSocket after game over');
                                stompClientRef.current?.deactivate();
                            } catch (e) {
                                console.error('Error disconnecting WebSocket:', e);
                            }
                        }, 500);
                    }
                } catch (e) {
                    console.error('Invalid game update', e);
                }
            });

            // Subscribe to lobby updates to detect player joins
            client.subscribe('/topic/lobbies', (msg: IMessage) => {
                try {
                    const payload = JSON.parse(msg.body);

                    // Ignore lobby updates if game is finished
                    if (gamePhaseRef.current === 'finished') {
                        console.log('🚫 Ignoring lobby update - game already finished');
                        return;
                    }

                    if (payload.id === roomId && payload.currentPlayers >= 2) {
                        setOpponentConnected(true);
                        setGamePhase(prev => (prev === 'waiting' ? 'placement' : prev));
                    }
                } catch (e) {
                    console.error('Invalid lobby update', e);
                }
            });
        };

        // Only activate WebSocket if game is not finished
        if (!gameFinished) {
            client.activate();
            stompClientRef.current = client;
        } else {
            console.log('🚫 Skipping WebSocket activation - game already finished');
        }

        return () => {
            mounted = false;
            console.log('Game: unmount cleanup', { isHost: isHostRef.current, roomId });

            try {
                client?.deactivate();
            } catch (e) {
                console.error('Error deactivating WebSocket', e);
            }

            // Don't delete lobby on cleanup - backend handles this
            // Deleting here causes navigation issues and unwanted re-renders
        };
    }, [roomId, user, navigate, deleteLobbyIfHost]);

    // Speed mode timer countdown - runs for all players to show real-time countdown
    useEffect(() => {
        if (gameMode !== 'speed' || gamePhase !== 'playing' || turnTimeLimit === 0) {
            return;
        }

        // Always start from the limit when the effect runs (triggered by turn changes)
        setTurnTimeRemaining(turnTimeLimit);

        const interval = setInterval(() => {
            setTurnTimeRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);

                    // Only send timeout if it's MY turn
                    if (isMyTurn && stompClientRef.current && roomId && user) {
                        console.log('⏱️ Time expired! Sending timeout to server...');
                        stompClientRef.current.publish({
                            destination: `/app/game/${roomId}/timeout`,
                            body: JSON.stringify({
                                playerId: user.id
                            })
                        });
                    }

                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [gameMode, isMyTurn, gamePhase, turnTimeLimit, roomId, user]);

    const handleLeaveToLobby = useCallback(() => {
        console.log('🚪 Leaving game to lobby');

        // Clear pending attacks
        setPendingAttacks([]);

        // Disconnect WebSocket immediately
        try {
            if (stompClientRef.current) {
                console.log('🔌 Deactivating WebSocket connection');
                stompClientRef.current.deactivate();
                stompClientRef.current = null;
            }
        } catch (e) {
            console.error('Error deactivating WebSocket during leave:', e);
        }

        // Navigate to lobby immediately - don't try to clean up backend state
        // Backend will handle cleanup when players disconnect
        navigate('/lobby', { replace: true });
    }, [navigate]);


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

        // Check if this cell has already been attacked
        const alreadyAttacked = myAttacks.some(attack => attack.row === row && attack.col === col) || pendingAttacks.some(attack => attack.row === row && attack.col === col);
        if (alreadyAttacked) {
            console.log('❌ Cell already attacked or pending', { row, col });
            return;
        }

        console.log(`🎯 Attacking cell: [${row}, ${col}]`);

        // Mark as pending locally to avoid duplicate sends while waiting for server response
        setPendingAttacks(prev => [...prev, { row, col }]);
        // Safety: remove pending entry if server doesn't respond in reasonable time
        setTimeout(() => {
            setPendingAttacks(prev => prev.filter(p => !(p.row === row && p.col === col)));
        }, 8000);

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
        <div className="min-h-screen bg-gradient-to-br from-[#0b1220] via-[#101a2e] to-[#0b1220] p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon via-cyan to-accent mb-2 animate-pulse">
                        🚢 Battleship Arena
                    </h1>
                    <div className="flex flex-wrap gap-2 sm:gap-3 items-center text-xs sm:text-sm">
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-semibold border backdrop-blur-sm transition-all duration-300 ${
                            gamePhase === 'waiting' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-lg shadow-yellow-500/20' :
                            gamePhase === 'placement' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-lg shadow-blue-500/20' :
                            gamePhase === 'ready' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-lg shadow-purple-500/20 animate-pulse' :
                            gamePhase === 'finished' ? (winner === user?.id ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-lg shadow-green-500/20' : 'bg-red-500/20 text-red-400 border-red-500/50 shadow-lg shadow-red-500/20') :
                            isMyTurn ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-lg shadow-green-500/20 animate-pulse' : 'bg-red-500/20 text-red-400 border-red-500/50 shadow-lg shadow-red-500/20'
                        }`}>
                            {gamePhase === 'waiting' && '⏳ Waiting for opponent...'}
                            {gamePhase === 'placement' && '📍 Place your ships'}
                            {gamePhase === 'ready' && '⏰ Waiting for opponent...'}
                            {gamePhase === 'playing' && (isMyTurn ? '🎯 Your Turn' : '⏳ Opponent\'s Turn')}
                            {gamePhase === 'finished' && (winner === user?.id ? '🏆 Victory!' : '💀 Defeat')}
                        </span>
                        <span className="px-2 sm:px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-semibold">
                            👥 {opponentConnected ? '2/2' : '1/2'}
                        </span>
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-semibold border ${
                            gameMode === 'speed' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                            gameMode === 'ranked' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                            'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        }`}>
                            {gameMode === 'speed' && '⚡ Speed'}
                            {gameMode === 'ranked' && '🏆 Ranked'}
                            {gameMode === 'classic' && '⚓ Classic'}
                        </span>
                        {gameMode === 'speed' && gamePhase === 'playing' && turnTimeLimit > 0 && (
                            <span className={`px-2 sm:px-3 py-1 rounded-full font-bold border transition-all duration-300 ${
                                isMyTurn ? (
                                    turnTimeRemaining <= 1 ? 'bg-red-500/30 text-red-300 border-red-500/50 animate-pulse shadow-lg shadow-red-500/30' : 
                                    turnTimeRemaining <= 2 ? 'bg-orange-500/30 text-orange-300 border-orange-500/50 shadow-lg shadow-orange-500/30' : 
                                    'bg-green-500/20 text-green-300 border-green-500/50 shadow-lg shadow-green-500/30'
                                ) : (
                                    'bg-blue-500/20 text-blue-300 border-blue-500/50'
                                )
                            }`}>
                                ⏱️ {turnTimeRemaining}s {!isMyTurn && <span className="hidden sm:inline">(Opponent)</span>}
                            </span>
                        )}
                        {isHost && (
                            <span className="px-2 sm:px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/50 font-semibold">
                                👑 Host
                            </span>
                        )}
                    </div>
                </div>

                {/* Waiting Phase - Elegant Waiting Room */}
                {gamePhase === 'waiting' && (
                    <div className="relative overflow-hidden">
                        {/* Background gradient effects */}
                        <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-accent/5 blur-3xl"></div>
                        <div className="absolute top-0 left-1/4 w-64 h-64 bg-neon/10 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

                        <div className="relative bg-card/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-12 md:p-16 border border-accent/30 shadow-2xl shadow-neon/10 text-center">
                            {/* Animated icon */}
                            <div className="relative inline-block mb-6 sm:mb-8">
                                <div className="text-6xl sm:text-8xl md:text-9xl animate-bounce">⚓</div>
                                <div className="absolute -inset-4 bg-gradient-to-r from-neon to-accent rounded-full blur-2xl opacity-20 animate-pulse"></div>
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon via-cyan to-accent mb-4 sm:mb-6">
                                Waiting for Opponent
                            </h2>

                            <p className="text-base sm:text-lg md:text-xl text-muted mb-4 sm:mb-6 max-w-2xl mx-auto">
                                Share this room code with your friend to start the battle
                            </p>

                            {/* Room Code Display */}
                            <div className="inline-block mb-6 sm:mb-8 relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-neon to-accent rounded-xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                                <div className="relative bg-card/50 backdrop-blur-sm border-2 border-neon/50 rounded-xl px-6 sm:px-10 py-4 sm:py-6">
                                    <div className="text-xs sm:text-sm text-muted mb-2 font-semibold uppercase tracking-wider">Room Code</div>
                                    <div className="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon to-accent tracking-wider">
                                        {roomId?.substring(0, 8).toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            {/* Loading animation */}
                            <div className="flex justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-neon rounded-full animate-bounce shadow-lg shadow-neon/50" style={{ animationDelay: '0s' }}></div>
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-cyan rounded-full animate-bounce shadow-lg shadow-cyan/50" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-accent rounded-full animate-bounce shadow-lg shadow-accent/50" style={{ animationDelay: '0.4s' }}></div>
                            </div>

                            {/* Game info cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto mb-6 sm:mb-8">
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-3 sm:p-4 hover:border-neon/50 transition-all duration-300 hover:shadow-lg hover:shadow-neon/20">
                                    <div className="text-2xl sm:text-3xl mb-2">
                                        {gameMode === 'speed' && '⚡'}
                                        {gameMode === 'ranked' && '🏆'}
                                        {gameMode === 'classic' && '⚓'}
                                    </div>
                                    <div className="text-xs sm:text-sm text-muted font-semibold uppercase tracking-wider mb-1">Mode</div>
                                    <div className="text-base sm:text-lg font-bold text-accent capitalize">{gameMode}</div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-3 sm:p-4 hover:border-neon/50 transition-all duration-300 hover:shadow-lg hover:shadow-neon/20">
                                    <div className="text-2xl sm:text-3xl mb-2">👥</div>
                                    <div className="text-xs sm:text-sm text-muted font-semibold uppercase tracking-wider mb-1">Players</div>
                                    <div className="text-base sm:text-lg font-bold text-accent">1 / 2</div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-3 sm:p-4 hover:border-neon/50 transition-all duration-300 hover:shadow-lg hover:shadow-neon/20">
                                    <div className="text-2xl sm:text-3xl mb-2">🌊</div>
                                    <div className="text-xs sm:text-sm text-muted font-semibold uppercase tracking-wider mb-1">Grid Size</div>
                                    <div className="text-base sm:text-lg font-bold text-accent">10 × 10</div>
                                </div>
                            </div>

                            {/* Leave button */}
                            <button
                                onClick={handleLeaveToLobby}
                                className="px-6 sm:px-8 py-3 sm:py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border-2 border-red-500/50 hover:border-red-500 transition-all duration-300 font-bold text-sm sm:text-base shadow-lg hover:shadow-red-500/20 hover:scale-105"
                            >
                                Leave Room
                            </button>
                        </div>
                    </div>
                )}

                {/* Placement Phase */}
                {gamePhase === 'placement' && (
                    <div className="relative">
                        {/* Background effects */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-accent/5 blur-3xl -z-10"></div>

                        <div className="max-w-4xl mx-auto">
                            <div className="bg-card/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-accent/30 shadow-2xl shadow-blue-500/10 overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-blue-500/20 via-accent/20 to-blue-500/20 border-b border-accent/30 p-4 sm:p-6">
                                    <div className="text-center">
                                        <div className="text-4xl sm:text-5xl mb-3">📍</div>
                                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan to-accent mb-2">
                                            Deploy Your Fleet
                                        </h2>
                                        <p className="text-sm sm:text-base text-muted">
                                            Position your ships strategically on the battlefield
                                        </p>
                                    </div>
                                </div>

                                {/* Ship placement component */}
                                <div className="p-4 sm:p-6">
                                    <ShipPlacement onPlacementComplete={handleShipPlacementComplete} />
                                </div>

                                {/* Footer with instructions */}
                                <div className="bg-gradient-to-r from-accent/10 via-blue-500/10 to-accent/10 border-t border-accent/30 p-4 sm:p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                        <div className="bg-card/40 rounded-lg p-3 border border-accent/20">
                                            <div className="text-sm font-semibold text-accent mb-1">💡 Quick Tip</div>
                                            <div className="text-xs text-muted">Click and drag ships to position them on the grid</div>
                                        </div>
                                        <div className="bg-card/40 rounded-lg p-3 border border-accent/20">
                                            <div className="text-sm font-semibold text-accent mb-1">🔄 Rotate Ships</div>
                                            <div className="text-xs text-muted">Click on a ship to rotate its orientation</div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleLeaveToLobby}
                                        className="w-full sm:w-auto px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border-2 border-red-500/50 hover:border-red-500 transition-all duration-300 font-bold text-sm sm:text-base shadow-lg hover:shadow-red-500/20 hover:scale-105"
                                    >
                                        Leave Game
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Ready Phase - Waiting for opponent */}
                {gamePhase === 'ready' && (
                    <div className="relative overflow-hidden">
                        {/* Background gradient effects */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-accent/5 blur-3xl"></div>
                        <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

                        <div className="relative bg-card/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-12 md:p-16 border border-purple-500/30 shadow-2xl shadow-purple-500/10 text-center">
                            {/* Animated checkmark */}
                            <div className="relative inline-block mb-6 sm:mb-8">
                                <div className="text-6xl sm:text-8xl md:text-9xl animate-pulse">✓</div>
                                <div className="absolute -inset-4 bg-gradient-to-r from-purple-500 to-accent rounded-full blur-2xl opacity-20 animate-pulse"></div>
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-300 to-accent mb-4 sm:mb-6">
                                You're Ready!
                            </h2>

                            <p className="text-base sm:text-lg md:text-xl text-muted mb-6 sm:mb-8 max-w-2xl mx-auto">
                                Your fleet is deployed and battle-ready. Waiting for your opponent to finish their preparations...
                            </p>

                            {/* Status indicators */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto mb-6 sm:mb-8">
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 sm:p-6">
                                    <div className="text-3xl sm:text-4xl mb-2">✓</div>
                                    <div className="text-sm sm:text-base font-bold text-green-400">You</div>
                                    <div className="text-xs text-muted mt-1">Ready</div>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 sm:p-6">
                                    <div className="flex justify-center gap-1 mb-2">
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                                    </div>
                                    <div className="text-sm sm:text-base font-bold text-yellow-400">Opponent</div>
                                    <div className="text-xs text-muted mt-1">Deploying...</div>
                                </div>
                            </div>

                            {/* Your ships summary */}
                            <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-4 sm:p-6 max-w-md mx-auto mb-6 sm:mb-8">
                                <h3 className="text-base sm:text-lg font-bold text-accent mb-3 flex items-center justify-center gap-2">
                                    <span>⚓</span> Your Fleet
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                                    {myShips.map(ship => (
                                        <div key={ship.id} className="bg-accent/5 border border-accent/20 rounded-lg p-2 flex items-center justify-between">
                                            <span className="text-accent font-semibold truncate">{ship.name}</span>
                                            <span className="text-green-400 ml-2">✓</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Loading animation */}
                            <div className="flex justify-center gap-2 sm:gap-3">
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-400 rounded-full animate-pulse shadow-lg shadow-purple-400/50"></div>
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-400 rounded-full animate-pulse shadow-lg shadow-purple-400/50" style={{ animationDelay: '0.3s' }}></div>
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-400 rounded-full animate-pulse shadow-lg shadow-purple-400/50" style={{ animationDelay: '0.6s' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Finished Phase - Victory/Defeat Screen */}
                {gamePhase === 'finished' && (
                    <div className="relative overflow-hidden">
                        {/* Background gradient effects */}
                        <div className={`absolute inset-0 blur-3xl ${
                            winner === user?.id 
                                ? 'bg-gradient-to-br from-green-500/10 via-transparent to-green-500/10' 
                                : 'bg-gradient-to-br from-red-500/10 via-transparent to-red-500/10'
                        }`}></div>
                        <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${
                            winner === user?.id ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}></div>

                        <div className={`relative rounded-2xl sm:rounded-3xl p-6 sm:p-12 md:p-16 border-2 text-center shadow-2xl backdrop-blur-xl ${
                            winner === user?.id 
                                ? 'bg-green-900/20 border-green-500/50 shadow-green-500/20' 
                                : 'bg-red-900/20 border-red-500/50 shadow-red-500/20'
                        }`}>
                            {/* Animated trophy/skull */}
                            <div className="relative inline-block mb-6 sm:mb-8">
                                <div className={`text-7xl sm:text-8xl md:text-9xl ${
                                    winner === user?.id ? 'animate-bounce' : ''
                                }`}>
                                    {winner === user?.id ? '🏆' : '💀'}
                                </div>
                                <div className={`absolute -inset-6 rounded-full blur-3xl opacity-30 animate-pulse ${
                                    winner === user?.id ? 'bg-gradient-to-r from-green-400 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-orange-500'
                                }`}></div>
                            </div>

                            <h2 className={`text-4xl sm:text-5xl md:text-6xl font-black mb-4 sm:mb-6 ${
                                winner === user?.id ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {winner === user?.id ? 'VICTORY!' : 'DEFEAT'}
                            </h2>

                            <p className="text-base sm:text-lg md:text-xl text-muted mb-6 sm:mb-8 max-w-2xl mx-auto">
                                {winReason === 'forfeit' && gameOverMessage ? (
                                    // Display forfeit message
                                    winner === user?.id ? (
                                        <span className="text-green-300">🎉 {gameOverMessage}</span>
                                    ) : (
                                        <span className="text-red-300">😔 You left the game</span>
                                    )
                                ) : (
                                    // Display normal win/loss message
                                    winner === user?.id
                                        ? <span className="text-green-300">🎯 You destroyed all enemy ships!</span>
                                        : <span className="text-red-300">💥 All your ships were destroyed!</span>
                                )}
                            </p>

                            {/* RP Change for Ranked Mode */}
                            {gameMode.toLowerCase() === 'ranked' && rpChange !== null && (
                                <div className={`inline-block mb-6 sm:mb-8 px-6 sm:px-10 py-4 sm:py-6 rounded-xl border-2 shadow-xl transition-all hover:scale-105 ${
                                    rpChange > 0 
                                        ? 'bg-green-500/20 border-green-500 shadow-green-500/30' 
                                        : 'bg-red-500/20 border-red-500 shadow-red-500/30'
                                }`}>
                                    <div className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-2 opacity-80">
                                        Ranking Points
                                    </div>
                                    <div className={`text-4xl sm:text-5xl md:text-6xl font-black ${
                                        rpChange > 0 ? 'text-green-300' : 'text-red-300'
                                    }`}>
                                        {rpChange > 0 ? '+' : ''}{rpChange} RP
                                    </div>
                                </div>
                            )}

                            {/* Battle Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto mb-6 sm:mb-8">
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-4 hover:border-accent/50 transition-all">
                                    <div className="text-2xl sm:text-3xl mb-2">💣</div>
                                    <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Hits</div>
                                    <div className="text-2xl sm:text-3xl font-black text-red-400">
                                        {myAttacks.filter(a => a.isHit).length}
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-4 hover:border-accent/50 transition-all">
                                    <div className="text-2xl sm:text-3xl mb-2">🌊</div>
                                    <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Misses</div>
                                    <div className="text-2xl sm:text-3xl font-black text-blue-400">
                                        {myAttacks.filter(a => !a.isHit).length}
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-4 hover:border-accent/50 transition-all">
                                    <div className="text-2xl sm:text-3xl mb-2">📊</div>
                                    <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Accuracy</div>
                                    <div className="text-2xl sm:text-3xl font-black text-accent">
                                        {myAttacks.length > 0
                                            ? Math.round((myAttacks.filter(a => a.isHit).length / myAttacks.length) * 100)
                                            : 0}%
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-center">
                                <button
                                    onClick={handleLeaveToLobby}
                                    className="px-6 sm:px-8 py-3 sm:py-4 bg-cyan/20 hover:bg-cyan/30 text-cyan rounded-xl border-2 border-cyan/50 hover:border-cyan transition-all duration-300 text-base sm:text-lg font-bold shadow-lg hover:shadow-cyan/20 hover:scale-105"
                                >
                                    Return to Lobby
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Playing Phase - Game Boards */}
                {gamePhase === 'playing' && (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Turn indicator banner for mobile */}
                        <div className={`sm:hidden bg-gradient-to-r rounded-xl p-4 border-2 shadow-lg transition-all duration-300 ${
                            isMyTurn 
                                ? 'from-green-500/20 to-green-600/20 border-green-500/50 shadow-green-500/20' 
                                : 'from-red-500/20 to-red-600/20 border-red-500/50 shadow-red-500/20'
                        }`}>
                            <div className="text-center">
                                <div className="text-3xl mb-2">{isMyTurn ? '💣' : '⏳'}</div>
                                <div className="text-lg font-black text-accent">
                                    {isMyTurn ? 'YOUR TURN!' : 'OPPONENT\'S TURN'}
                                </div>
                                {isMyTurn && (
                                    <div className="text-sm text-muted mt-1">Tap enemy waters to attack</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                            {/* Your Board */}
                            <div className="space-y-3 order-2 lg:order-1">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan to-accent flex items-center gap-2">
                                        <span>🛡️</span>
                                        <span className="hidden sm:inline">Your Fleet</span>
                                        <span className="sm:hidden">Fleet</span>
                                    </h2>
                                    <div className="text-xs sm:text-sm text-muted">
                                        <span className="text-red-400 font-bold">{opponentAttacks.filter(a => a.isHit).length}</span>
                                        <span className="mx-1">/</span>
                                        <span className="text-muted">{opponentAttacks.length} attacks</span>
                                    </div>
                                </div>

                                {/* 3D Board Container - Responsive height */}
                                <div className="relative bg-card/30 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-cyan/30 overflow-hidden shadow-xl shadow-cyan/10 hover:border-cyan/50 transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 to-transparent"></div>
                                    <div className="relative" style={{ height: 'clamp(300px, 50vh, 500px)' }}>
                                        <GameBoard3D
                                            isPlayerBoard={true}
                                            boardSize={10}
                                            initialShips={myShips.map(ship => ({
                                                ...ship,
                                                hits: 0
                                            }))}
                                            attacks={opponentAttacks}
                                            pendingAttacks={pendingAttacks}
                                        />
                                    </div>
                                </div>

                                {/* Ship status - Collapsible on mobile */}
                                <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-cyan/30 overflow-hidden shadow-lg">
                                    <details className="group" open={typeof window !== 'undefined' && window.innerWidth >= 640}>
                                        <summary className="cursor-pointer p-3 sm:p-4 hover:bg-cyan/5 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-base sm:text-lg font-bold text-cyan inline-flex items-center gap-2">
                                                    <span>⚓</span> Your Ships
                                                </h3>
                                                <span className="text-xs text-muted group-open:rotate-180 transition-transform">▼</span>
                                            </div>
                                        </summary>
                                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 text-xs sm:text-sm">
                                            {myShips.map(ship => {
                                                const hits = opponentAttacks.filter(attack =>
                                                    attack.isHit && ship.positions.some(pos => pos.row === attack.row && pos.col === attack.col)
                                                ).length;
                                                const isSunk = hits >= ship.size;

                                                return (
                                                    <div key={ship.id} className={`flex justify-between items-center p-2 rounded-lg border transition-all ${
                                                        isSunk ? 'bg-red-500/10 border-red-500/30' : 'bg-cyan/5 border-cyan/20'
                                                    }`}>
                                                        <span className={`font-semibold ${isSunk ? 'text-red-400 line-through' : 'text-accent'}`}>
                                                            🚢 {ship.name} <span className="text-muted text-xs">({ship.size})</span>
                                                        </span>
                                                        <div className="flex gap-1">
                                                            {Array.from({ length: ship.size }).map((_, i) => (
                                                                <span key={i} className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full border transition-all ${
                                                                    i < hits 
                                                                        ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50' 
                                                                        : 'bg-green-500 border-green-400 shadow-sm shadow-green-500/30'
                                                                }`}></span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </details>
                                </div>
                            </div>

                            {/* Opponent's Board */}
                            <div className="space-y-3 order-1 lg:order-2">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 flex items-center gap-2">
                                        <span>💣</span>
                                        <span className="hidden sm:inline">Enemy Waters</span>
                                        <span className="sm:hidden">Enemy</span>
                                    </h2>
                                    <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold border ${
                                        isMyTurn 
                                            ? 'bg-green-500/20 text-green-400 border-green-500/50 animate-pulse' 
                                            : 'bg-red-500/20 text-red-400 border-red-500/50'
                                    }`}>
                                        {isMyTurn ? '💣 FIRE!' : '⏳ WAIT'}
                                    </div>
                                </div>

                                {/* 3D Board Container - Responsive height */}
                                <div className="relative bg-card/30 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-red-400/30 overflow-hidden shadow-xl shadow-red-400/10 hover:border-red-400/50 transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent"></div>
                                    <div className="relative" style={{ height: 'clamp(300px, 50vh, 500px)' }}>
                                        <GameBoard3D
                                            isPlayerBoard={false}
                                            boardSize={10}
                                            onCellClick={handleCellClick}
                                            isClickable={isMyTurn}
                                            initialShips={[]}
                                            attacks={myAttacks}
                                            pendingAttacks={pendingAttacks}
                                        />
                                    </div>
                                </div>

                                {/* Attack stats */}
                                <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-red-400/30 p-3 sm:p-4 shadow-lg">
                                    <h3 className="text-base sm:text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                                        <span>📊</span> Attack Stats
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3 text-center">
                                            <div className="text-xs sm:text-sm text-muted mb-1">Hits</div>
                                            <div className="text-xl sm:text-3xl font-black text-red-400">
                                                {myAttacks.filter(a => a.isHit).length}
                                            </div>
                                        </div>
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3 text-center">
                                            <div className="text-xs sm:text-sm text-muted mb-1">Misses</div>
                                            <div className="text-xl sm:text-3xl font-black text-blue-400">
                                                {myAttacks.filter(a => !a.isHit).length}
                                            </div>
                                        </div>
                                        <div className="bg-accent/10 border border-accent/30 rounded-lg p-2 sm:p-3 text-center">
                                            <div className="text-xs sm:text-sm text-muted mb-1">Accuracy</div>
                                            <div className="text-xl sm:text-3xl font-black text-accent">
                                                {myAttacks.length > 0
                                                    ? Math.round((myAttacks.filter(a => a.isHit).length / myAttacks.length) * 100)
                                                    : 0}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Game controls - Mobile optimized */}
                        <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-accent/30 p-3 sm:p-4 shadow-lg">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                                <div className="text-center sm:text-left text-xs sm:text-sm text-muted w-full sm:w-auto">
                                    <span className="hidden sm:inline">💡 <span className="font-semibold">Tip:</span> Click enemy waters to attack. Drag to rotate camera.</span>
                                    <span className="sm:hidden">💡 Tap to attack • Drag to rotate</span>
                                </div>
                                <button
                                    onClick={handleLeaveToLobby}
                                    className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border-2 border-red-500/50 hover:border-red-500 transition-all duration-300 font-bold text-sm sm:text-base hover:scale-105 shadow-lg hover:shadow-red-500/20"
                                >
                                    Leave Game
                                </button>
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
