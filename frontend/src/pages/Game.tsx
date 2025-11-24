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

// Prefer explicit endpoint; otherwise build one that targets backend directly (bypasses Vite proxy)
const buildWsEndpoint = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
    const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https://' : 'http://';
    return `${protocol}${host}:8080/ws`;
};
const WS_ENDPOINT = buildWsEndpoint();

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
    // Cells that are known-blocked by server (ATTACK_ERROR) to avoid resending
    const [blockedCells, setBlockedCells] = useState<Record<string, true>>({});
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

                            // Determine which player we are (needed to interpret attack lists)
                            const isPlayer1 = user && gameState.player1Id === user.id;

                            // Build blockedCells from authoritative game state but only from the attacks made by THIS player
                            try {
                                const blocked: Record<string, true> = {};
                                const playerAttacks = isPlayer1 ? (Array.isArray(gameState.player1Attacks) ? gameState.player1Attacks : []) : (Array.isArray(gameState.player2Attacks) ? gameState.player2Attacks : []);
                                for (const a of playerAttacks) { blocked[`${Number(a.row)}-${Number(a.col)}`] = true; }
                                setBlockedCells(blocked);
                            } catch (e) {
                                // non-fatal
                            }

                            // Restore game mode
                            if (gameState.gameMode) {
                                setGameMode(gameState.gameMode);
                                console.log('Restored game mode:', gameState.gameMode);
                            }

                            // Determine which player we are
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

                        // Mark blocked cell immediately so UI won't try to resend while reconciling
                        setBlockedCells(prev => ({ ...prev, [`${payload.row}-${payload.col}`]: true }));

                        // If we had this attack pending, remove it so the user can try another cell
                        try {
                            setPendingAttacks(prev => prev.filter(p => !(p.row === payload.row && p.col === payload.col)));
                        } catch (e) {}

                        // The backend is authoritative. If we receive an ATTACK_ERROR it means the cell was already attacked
                        // by someone else (or an earlier request). Reconcile UI by fetching the current game state and updating
                        // the local attack arrays so the board displays the cell as attacked.
                        (async () => {
                            try {
                                if (!roomId) return;
                                const gsRes = await api.get(`/api/game-state/${roomId}`);
                                const gs = gsRes.data;
                                if (!gs) return;

                                const isPlayer1 = user && gs.player1Id === user.id;
                                const playerAttacks = isPlayer1 ? (gs.player1Attacks || []) : (gs.player2Attacks || []);
                                const opponentAttacks = isPlayer1 ? (gs.player2Attacks || []) : (gs.player1Attacks || []);

                                // Normalize and set arrays separately (playerAttacks are attacks made by THIS player on opponent's board)
                                const normalize = (a:any) => ({ row: Number(a.row), col: Number(a.col), isHit: !!a.isHit });
                                const normalizedPlayerAttacks = Array.isArray(playerAttacks) ? playerAttacks.map(normalize) : [];
                                const normalizedOpponentAttacks = Array.isArray(opponentAttacks) ? opponentAttacks.map(normalize) : [];
                                setMyAttacks(normalizedPlayerAttacks);
                                setOpponentAttacks(normalizedOpponentAttacks);

                                // Update blockedCells to reflect attacks made by THIS player
                                try {
                                    const blocked: Record<string, true> = {};
                                    for (const a of normalizedPlayerAttacks) blocked[`${a.row}-${a.col}`] = true;
                                    setBlockedCells(prev => ({ ...prev, ...blocked }));
                                } catch (e) {}

                                // Also remove any pending entry for that cell (defensive)
                                setPendingAttacks(prev => prev.filter(p => !(p.row === payload.row && p.col === payload.col)));

                                // Defensive fallback: if neither attack list contains the cell, add a local marker so UI shows it as attacked
                                const existsKey = `${payload.row}-${payload.col}`;
                                const playerHasCell = normalizedPlayerAttacks.some(a => a.row === payload.row && a.col === payload.col);
                                const opponentHasCell = normalizedOpponentAttacks.some(a => a.row === payload.row && a.col === payload.col);
                                if (!playerHasCell && !opponentHasCell) {
                                    // Defensive: mark it on myAttacks (so enemy board shows it blocked) as a miss
                                    setMyAttacks(prev => {
                                        if (prev.some(a => Number(a.row) === payload.row && Number(a.col) === payload.col)) return prev;
                                        return [...prev, { row: payload.row, col: payload.col, isHit: false }];
                                    });
                                    setBlockedCells(prev => ({ ...prev, [existsKey]: true }));
                                } else {
                                    // ensure blocked cell is set if server already recorded it
                                    if (playerHasCell) setBlockedCells(prev => ({ ...prev, [existsKey]: true }));
                                }

                                console.log('Reconciled attacks from server after ATTACK_ERROR', { roomId, isPlayer1 });
                            } catch (err) {
                                console.warn('Failed to reconcile game state after ATTACK_ERROR', err);
                                // As a last resort, ensure pending is cleared so user can continue
                                setPendingAttacks(prev => prev.filter(p => !(p.row === payload.row && p.col === payload.col)));
                                // And locally mark the cell as attacked to avoid repeated backend rejects
                                setMyAttacks(prev => {
                                    if (prev.some(a => Number(a.row) === payload.row && Number(a.col) === payload.col)) return prev;
                                    return [...prev, { row: payload.row, col: payload.col, isHit: false }];
                                });
                                setBlockedCells(prev => ({ ...prev, [`${payload.row}-${payload.col}`]: true }));
                            }
                        })();
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

        // Notify server about leaving the lobby (non-host)
        (async () => {
            try {
                if (!roomId) return;
                // If the user is host, deleteLobbyIfHost will remove the lobby (already present elsewhere)
                if (isHostRef.current) {
                    console.log('User is host; attempting to delete lobby on leave');
                    await deleteLobbyIfHost();
                } else {
                    // Non-host should notify server they left so the slot is freed
                    try {
                        await api.patch(`/api/lobbies/${roomId}/leave`);
                        console.log('Notified server about leaving lobby');
                    } catch (err) {
                        console.warn('Failed to notify server about leaving lobby', err);
                    }
                }
            } catch (e) {
                console.error('Error during leave notification', e);
            } finally {
                navigate('/lobby', { replace: true });
            }
        })();
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

    // Helper: attempt to send attack with retries while WS reconnects
    const sendAttackWithRetry = (row: number, col: number, maxAttempts = 6) => {
        let attempt = 0;
        const trySend = () => {
            attempt++;
            if (stompClientRef.current && (stompClientRef.current.connected || (stompClientRef.current as any).active)) {
                try {
                    stompClientRef.current.publish({
                        destination: `/app/game/${roomId}/attack`,
                        body: JSON.stringify({ playerId: user?.id, row, col })
                    });
                    console.log(`✓ Attack published on attempt ${attempt} [${row},${col}]`);
                    return;
                } catch (e) {
                    console.warn('Publish failed, will retry', e);
                }
            } else {
                console.log(`WS not ready (attempt ${attempt}), will retry shortly...`);
                try {
                    stompClientRef.current?.activate();
                } catch (e) {}
            }

            if (attempt < maxAttempts) {
                setTimeout(trySend, 500 * attempt);
            } else {
                console.error('Failed to send attack after retries, clearing pending:', { row, col });
                // clear pending so UI doesn't block forever
                setPendingAttacks(prev => prev.filter(p => !(p.row === row && p.col === col)));
                // Mark blocked? No — notify the user instead
                try { alert('Could not send attack due to network issues. Please try again.'); } catch (e) {}
            }
        };
        trySend();
    };

    const handleCellClick = (row: number, col: number) => {
        if (!isMyTurn || gamePhase !== 'playing') {
            console.log('❌ Not your turn or game not started', { isMyTurn, gamePhase });
            return;
        }

        const key = `${row}-${col}`;

        // Check if this cell has already been attacked by me, pending locally, or blocked by server
        const alreadyAttacked = myAttacks.some(attack => attack.row === row && attack.col === col)
            || pendingAttacks.some(attack => attack.row === row && attack.col === col)
            || (blockedCells && blockedCells[key]);
        if (alreadyAttacked) {
            console.log('❌ Cell already attacked or pending/blocked', { row, col });
            return;
        }

        console.log(`🎯 Attacking cell: [${row}, ${col}]`);

        // Mark as pending locally to avoid duplicate sends while waiting for server response
        setPendingAttacks(prev => [...prev, { row, col }]);
        // Safety: remove pending entry if server doesn't respond in reasonable time
        setTimeout(() => {
            setPendingAttacks(prev => prev.filter(p => !(p.row === row && p.col === col)));
        }, 8000);

        // Try to send immediately, but if WS is down we'll retry in background
        // Send with retry helper (will attempt immediate publish or reconnect & retry)
        sendAttackWithRetry(row, col, 8);

        // Don't manually change turn - wait for backend TURN_CHANGE message
    };

    return (
        <div className="min-h-screen bg-[#0b1220] p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon via-cyan to-accent mb-2">
                        Battleship Arena
                    </h1>
                    <div className="flex flex-wrap gap-2 sm:gap-3 items-center text-xs sm:text-sm">
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-semibold border backdrop-blur-sm transition-all duration-300 ${
                            gamePhase === 'waiting' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' :
                            gamePhase === 'placement' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' :
                            gamePhase === 'ready' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 animate-pulse' :
                            gamePhase === 'finished' ? (winner === user?.id ? 'bg-green-500/20 text-green-300 border-green-500/50' : 'bg-red-500/20 text-red-300 border-red-500/50') :
                            isMyTurn ? 'bg-green-500/20 text-green-300 border-green-500/50 animate-pulse' : 'bg-red-500/20 text-red-300 border-red-500/50'
                        }`}>
                            {gamePhase === 'waiting' && 'Locked in - waiting'}
                            {gamePhase === 'placement' && 'Placing ships'}
                            {gamePhase === 'ready' && 'Ready'}
                            {gamePhase === 'playing' && (isMyTurn ? 'Your turn' : 'Opponent turn')}
                            {gamePhase === 'finished' && (winner === user?.id ? 'Victory' : 'Defeat')}
                        </span>
                        <span className="px-2 sm:px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-semibold">
                            {opponentConnected ? 'Players 2/2' : 'Players 1/2'}
                        </span>
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-semibold border ${
                            gameMode === 'speed' ? 'bg-orange-500/20 text-orange-200 border-orange-500/40' :
                            gameMode === 'ranked' ? 'bg-purple-500/20 text-purple-200 border-purple-500/40' :
                            'bg-blue-500/20 text-blue-200 border-blue-500/40'
                        }`}>
                            {gameMode === 'speed' && 'Speed'}
                            {gameMode === 'ranked' && 'Ranked'}
                            {gameMode === 'classic' && 'Classic'}
                        </span>
                        {gameMode === 'speed' && gamePhase === 'playing' && turnTimeLimit > 0 && (
                            <span className={`px-2 sm:px-3 py-1 rounded-full font-bold border transition-all duration-300 ${
                                isMyTurn ? (
                                    turnTimeRemaining <= 1 ? 'bg-red-500/30 text-red-300 border-red-500/50 animate-pulse' :
                                    turnTimeRemaining <= 2 ? 'bg-orange-500/30 text-orange-200 border-orange-500/50' :
                                    'bg-green-500/20 text-green-200 border-green-500/50'
                                ) : (
                                    'bg-blue-500/20 text-blue-200 border-blue-500/50'
                                )
                            }`}>
                                {turnTimeRemaining}s
                            </span>
                        )}
                        {isHost && (
                            <span className="px-2 sm:px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/50 font-semibold">
                                Host
                            </span>
                        )}
                    </div>
                </div>

                {/* Waiting Phase - Elegant Waiting Room */}
                
{gamePhase === 'waiting' && (
                    <div className="relative overflow-hidden">
                        <div className="relative rounded-3xl p-6 sm:p-10 md:p-12 border border-accent/30 shadow-2xl shadow-accent/10 bg-[#0b1220]">
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-purple-400/60 bg-purple-500/10 text-purple-200">
                                    Locked in - waiting
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-accent/40 bg-accent/10 text-accent">
                                    {opponentConnected ? 'Players 2/2' : 'Players 1/2'}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                    gameMode === 'speed' ? 'border-orange-400/60 text-orange-200 bg-orange-500/10' :
                                    gameMode === 'ranked' ? 'border-purple-400/60 text-purple-200 bg-purple-500/10' :
                                    'border-blue-400/60 text-blue-200 bg-blue-500/10'
                                }`}>
                                    {gameMode === 'speed' ? 'Speed' : gameMode === 'ranked' ? 'Ranked' : 'Classic'}
                                </span>
                            </div>

                            <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-[#0b1220] p-8 sm:p-10 text-center shadow-inner shadow-accent/10">
                                <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-accent/40 bg-accent/5 mx-auto mb-6 shadow-glow"></div>
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon via-cyan to-accent mb-3">
                                    Waiting for opponent
                                </h2>
                                <p className="text-sm sm:text-base text-muted max-w-2xl mx-auto">
                                    Share the room code and stay here. We keep the feed live while your opponent joins.
                                </p>

                                <div className="mt-6 inline-flex items-center gap-3 px-4 py-3 rounded-xl border border-neon/40 bg-neon/10 text-neon font-semibold">
                                    Room code: <span className="font-mono text-lg tracking-wide text-accent">{roomId?.substring(0, 8).toUpperCase()}</span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-accent/30 bg-card/50 p-3">
                                    <p className="text-xs uppercase tracking-[0.14em] text-muted">Mode</p>
                                    <p className="text-accent font-semibold mt-1 capitalize">{gameMode}</p>
                                </div>
                                <div className="rounded-xl border border-accent/30 bg-card/50 p-3">
                                    <p className="text-xs uppercase tracking-[0.14em] text-muted">Players</p>
                                    <p className="text-accent font-semibold mt-1">{opponentConnected ? '2 / 2 connected' : '1 / 2 connected'}</p>
                                </div>
                                <div className="rounded-xl border border-accent/30 bg-card/50 p-3">
                                    <p className="text-xs uppercase tracking-[0.14em] text-muted">Grid size</p>
                                    <p className="text-accent font-semibold mt-1">10 x 10</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
{/* Placement Phase */}
                {gamePhase === 'placement' && (
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-0 -z-10">
                            <div className="absolute -right-24 top-6 h-80 w-80 bg-[radial-gradient(circle_at_center,_rgba(0,180,216,0.16),_transparent_55%)] blur-3xl" />
                            <div className="absolute -left-16 bottom-0 h-[22rem] w-[22rem] bg-[radial-gradient(circle_at_center,_rgba(72,202,228,0.12),_transparent_55%)] blur-3xl" />
                        </div>

                        <div className="max-w-5xl mx-auto space-y-4">
                            <div className="rounded-2xl border border-accent bg-card/70 backdrop-blur p-6 sm:p-8">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Preparation</p>
                                        <h2 className="text-3xl font-bold text-neon">Deploy your fleet</h2>
                                        <p className="text-sm text-muted max-w-xl">
                                            Choose a ship, preview its footprint, and confirm placement. Rotate anytime before locking in.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 rounded-full border border-accent text-accent text-xs uppercase tracking-[0.2em]">
                                            Step 1/2
                                        </span>
                                        <span className="px-3 py-1 rounded-full border border-neon/50 bg-neon/10 text-neon text-xs font-semibold">
                                            Real-time sync on ready
                                        </span>
                                    </div>
                                </div>

                                <ShipPlacement onPlacementComplete={handleShipPlacementComplete} />

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-accent bg-navy/50 p-3">
                                        <p className="text-xs uppercase tracking-[0.14em] text-muted">Orientation</p>
                                        <p className="text-sm text-accent">Switch between horizontal and vertical for tight fits.</p>
                                    </div>
                                    <div className="rounded-xl border border-accent bg-navy/50 p-3">
                                        <p className="text-xs uppercase tracking-[0.14em] text-muted">Auto layout</p>
                                        <p className="text-sm text-accent">Use auto-place to start fast, then tweak manually.</p>
                                    </div>
                                    <div className="rounded-xl border border-accent bg-navy/50 p-3">
                                        <p className="text-xs uppercase tracking-[0.14em] text-muted">Fair play</p>
                                        <p className="text-sm text-accent">Board locks when both players click ready.</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleLeaveToLobby}
                                        className="px-5 py-2.5 rounded-lg border border-red-400/60 text-red-200 hover:bg-red-500/10 transition text-sm font-semibold"
                                    >
                                        Leave game
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
                                <h3 className="text-base sm:text-lg font-bold text-accent mb-3 text-center">
                                    Your fleet
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
                            <div className="relative inline-block mb-6 sm:mb-8">
                                <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 ${
                                    winner === user?.id ? 'border-green-400/70' : 'border-red-400/70'
                                } bg-gradient-to-br ${
                                    winner === user?.id ? 'from-green-500/30 to-yellow-400/20' : 'from-red-500/30 to-orange-400/20'
                                } shadow-lg`} />
                                <div className={`absolute -inset-4 rounded-3xl blur-2xl opacity-30 ${
                                    winner === user?.id ? 'bg-green-500/30' : 'bg-red-500/30'
                                }`}></div>
                            </div>

                            <h2 className={`text-4xl sm:text-5xl md:text-6xl font-black mb-4 sm:mb-6 ${
                                winner === user?.id ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {winner === user?.id ? 'VICTORY!' : 'DEFEAT'}
                            </h2>

                            <p className="text-base sm:text-lg md:text-xl text-muted mb-6 sm:mb-8 max-w-2xl mx-auto">
                                {winReason === 'forfeit' && gameOverMessage ? (
                                    winner === user?.id ? (
                                        <span className="text-green-300">{gameOverMessage}</span>
                                    ) : (
                                        <span className="text-red-300">You left the game</span>
                                    )
                                ) : (
                                    winner === user?.id
                                        ? <span className="text-green-300">You destroyed all enemy ships.</span>
                                        : <span className="text-red-300">All your ships were destroyed.</span>
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
                                    <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Hits</div>
                                    <div className="text-2xl sm:text-3xl font-black text-red-400">
                                        {myAttacks.filter(a => a.isHit).length}
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-4 hover:border-accent/50 transition-all">
                                    <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Misses</div>
                                    <div className="text-2xl sm:text-3xl font-black text-blue-400">
                                        {myAttacks.filter(a => !a.isHit).length}
                                    </div>
                                </div>
                                <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-4 hover:border-accent/50 transition-all">
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
                    <div className="relative bg-[#0b1220] border border-accent/30 rounded-3xl p-4 sm:p-6 md:p-7 shadow-2xl shadow-accent/10 space-y-4 sm:space-y-6">
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                isMyTurn ? 'bg-green-500/20 text-green-200 border-green-500/50' : 'bg-red-500/20 text-red-200 border-red-500/50'
                            }`}>
                                {isMyTurn ? 'Your turn' : 'Opponent turn'}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-accent/10 border-accent/30 text-accent">
                                {opponentConnected ? 'Players 2/2' : 'Players 1/2'}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                gameMode === 'speed' ? 'bg-orange-500/20 text-orange-200 border-orange-500/50' :
                                gameMode === 'ranked' ? 'bg-purple-500/20 text-purple-200 border-purple-500/50' :
                                'bg-blue-500/20 text-blue-200 border-blue-500/50'
                            }`}>
                                {gameMode === 'speed' && 'Speed'}
                                {gameMode === 'ranked' && 'Ranked'}
                                {gameMode === 'classic' && 'Classic'}
                            </span>
                            {gameMode === 'speed' && gamePhase === 'playing' && turnTimeLimit > 0 && (
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                    isMyTurn ? 'bg-green-500/20 text-green-200 border-green-500/50' : 'bg-blue-500/20 text-blue-200 border-blue-500/50'
                                }`}>
                                    {turnTimeRemaining}s
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                            {/* Your Board */}
                            <div className="space-y-3 order-2 lg:order-1">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan to-accent">
                                        Your fleet
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
                                            <h3 className="text-base sm:text-lg font-bold text-cyan">
                                                Your ships
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
                                                        {ship.name} <span className="text-muted text-xs">({ship.size})</span>
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
                                    <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                                        Enemy waters
                                    </h2>
                                    <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold border ${
                                        isMyTurn 
                                            ? 'bg-green-500/20 text-green-400 border-green-500/50 animate-pulse' 
                                            : 'bg-red-500/20 text-red-400 border-red-500/50'
                                    }`}>
                                        {isMyTurn ? 'Your move' : 'Waiting'}
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
                                <h3 className="text-base sm:text-lg font-bold text-red-400 mb-3">
                                    Attack stats
                                </h3>
                                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3 text-center">
                                        <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Hits</div>
                                        <div className="text-xl sm:text-3xl font-black text-red-400">
                                            {myAttacks.filter(a => a.isHit).length}
                                        </div>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3 text-center">
                                        <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Misses</div>
                                        <div className="text-xl sm:text-3xl font-black text-blue-400">
                                            {myAttacks.filter(a => !a.isHit).length}
                                        </div>
                                    </div>
                                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-2 sm:p-3 text-center">
                                        <div className="text-xs sm:text-sm text-muted mb-1 font-semibold uppercase tracking-wider">Accuracy</div>
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
                            <span className="hidden sm:inline"><span className="font-semibold">Tip:</span> Click enemy waters to attack. Drag to rotate camera.</span>
                            <span className="sm:hidden"><span className="font-semibold">Tip:</span> Tap to attack • Drag to rotate</span>
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
