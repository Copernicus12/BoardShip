package com.boardship.backend.controller;

import com.boardship.backend.model.GameState;
import com.boardship.backend.model.Lobby;
import com.boardship.backend.model.Match;
import com.boardship.backend.model.User;
import com.boardship.backend.repository.GameStateRepository;
import com.boardship.backend.repository.LobbyRepository;
import com.boardship.backend.repository.MatchRepository;
import com.boardship.backend.repository.UserRepository;
import com.boardship.backend.util.RankingUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
@Slf4j
public class GameController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MatchRepository matchRepository;
    private final LobbyRepository lobbyRepository;
    private final UserRepository userRepository;
    private final GameStateRepository gameStateRepository;

    // Track ready players per room: roomId -> playerId -> ships
    private final Map<String, Map<String, Object>> roomReadyPlayers = new ConcurrentHashMap<>();

    // Track whose turn it is: roomId -> currentPlayerId
    private final Map<String, String> roomCurrentTurn = new ConcurrentHashMap<>();

    // Track all players in a room: roomId -> List<playerId>
    private final Map<String, java.util.List<String>> roomPlayers = new ConcurrentHashMap<>();

    // Track attacks per room per player: roomId -> playerId -> Set of "row,col" strings
    private final Map<String, Map<String, java.util.Set<String>>> roomAttacksPerPlayer = new ConcurrentHashMap<>();

    // Track hit cells per room per player: roomId -> playerId -> Set of "row,col" strings
    private final Map<String, Map<String, java.util.Set<String>>> roomPlayerHits = new ConcurrentHashMap<>();

    // Track when each room's match started to compute duration
    private final Map<String, Instant> roomGameStart = new ConcurrentHashMap<>();

    // Track game mode for each room
    private final Map<String, String> roomGameMode = new ConcurrentHashMap<>();

    // Track turn start time for speed mode
    private final Map<String, Instant> roomTurnStartTime = new ConcurrentHashMap<>();

    // Speed mode configuration: time limit per turn in seconds
    private static final int SPEED_MODE_TURN_LIMIT_SECONDS = 3;

    @MessageMapping("/game/{roomId}/ready")
    public void playerReady(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        log.info("Player ready in room {}: {}", roomId, payload);

        String playerId = (String) payload.get("playerId");
        @SuppressWarnings("unchecked")
        java.util.List<Map<String, Object>> ships = (java.util.List<Map<String, Object>>) payload.get("ships");

        // Initialize room if not exists
        roomReadyPlayers.putIfAbsent(roomId, new ConcurrentHashMap<>());
        roomPlayers.putIfAbsent(roomId, new java.util.ArrayList<>());

        Map<String, Object> readyPlayers = roomReadyPlayers.get(roomId);
        java.util.List<String> players = roomPlayers.get(roomId);

        // Add player to room if not already there
        if (!players.contains(playerId)) {
            players.add(playerId);
        }

        // Mark this player as ready and store their ships
        readyPlayers.put(playerId, ships);

        // Persist to database
        GameState gameState = gameStateRepository.findById(roomId).orElse(null);
        if (gameState == null) {
            // Create new game state
            Lobby lobby = lobbyRepository.findById(roomId).orElse(null);
            if (lobby != null) {
                // Get game mode from lobby
                String gameMode = lobby.getMode() != null ? lobby.getMode().toLowerCase() : "classic";
                roomGameMode.put(roomId, gameMode);

                gameState = GameState.builder()
                    .id(roomId)
                    .player1Id(lobby.getHostId())
                    .player2Id(null) // Will be set when second player joins
                    .gamePhase("placement")
                    .gameMode(gameMode)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            }
        } else {
            // Load game mode from existing state
            if (gameState.getGameMode() != null) {
                roomGameMode.put(roomId, gameState.getGameMode());
            }
        }

        if (gameState != null) {
            // Determine which player is submitting ships
            if (playerId.equals(gameState.getPlayer1Id())) {
                gameState.setPlayer1Ships(ships);
                gameState.setPlayer1Ready(true);
            } else {
                // This is player 2
                if (gameState.getPlayer2Id() == null) {
                    gameState.setPlayer2Id(playerId);
                }
                gameState.setPlayer2Ships(ships);
                gameState.setPlayer2Ready(true);
            }
            gameState.setUpdatedAt(Instant.now());

            // Check if both players are ready
            if (gameState.isPlayer1Ready() && gameState.isPlayer2Ready()) {
                gameState.setGamePhase("playing");
                gameState.setCurrentTurn(gameState.getPlayer1Id()); // Player 1 goes first
            } else {
                gameState.setGamePhase("ready");
            }

            gameStateRepository.save(gameState);
            log.info("Persisted game state for room {}", roomId);
        }

        // Notify other players that this player is ready
        Map<String, Object> readyMessage = Map.of(
            "type", "PLAYER_READY",
            "playerId", playerId,
            "readyCount", readyPlayers.size()
        );
        messagingTemplate.convertAndSend("/topic/game/" + roomId, readyMessage);

        // If both players are ready, start the game
        if (readyPlayers.size() >= 2) {
            log.info("Both players ready in room {}, starting game", roomId);

            // First player in the list goes first
            String firstPlayerId = players.get(0);
            roomCurrentTurn.put(roomId, firstPlayerId);
            roomGameStart.put(roomId, Instant.now());

            // For speed mode, initialize turn timer
            String gameMode = roomGameMode.getOrDefault(roomId, "classic");
            if ("speed".equals(gameMode)) {
                roomTurnStartTime.put(roomId, Instant.now());
            }

            Map<String, Object> startMessage = Map.of(
                "type", "GAME_START",
                "firstPlayer", firstPlayerId,
                "roomId", roomId,
                "gameMode", gameMode,
                "turnTimeLimit", "speed".equals(gameMode) ? SPEED_MODE_TURN_LIMIT_SECONDS : 0
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, startMessage);
        }
    }

    @MessageMapping("/game/{roomId}/attack")
    public void attack(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        log.info("Attack in room {}: {}", roomId, payload);

        String attackerId = (String) payload.get("playerId");

        // Initialize room state from database if needed
        ensureRoomStateLoaded(roomId);

        // Check if game is already finished (prevent duplicate processing)
        if (roomCurrentTurn.get(roomId) == null) {
            log.warn("Player {} tried to attack but game is already finished in room {}", attackerId, roomId);
            return;
        }

        // Validate it's this player's turn
        String currentPlayer = roomCurrentTurn.get(roomId);
        if (!currentPlayer.equals(attackerId)) {
            log.warn("Player {} tried to attack but it's not their turn in room {}", attackerId, roomId);
            return;
        }

        // Check turn time limit for speed mode
        String gameMode = roomGameMode.getOrDefault(roomId, "classic");
        if ("speed".equals(gameMode)) {
            Instant turnStart = roomTurnStartTime.get(roomId);
            if (turnStart != null) {
                long elapsedSeconds = Duration.between(turnStart, Instant.now()).getSeconds();
                if (elapsedSeconds > SPEED_MODE_TURN_LIMIT_SECONDS) {
                    log.warn("Player {} exceeded turn time limit in speed mode ({}s elapsed)",
                             attackerId, elapsedSeconds);
                    // Auto-forfeit turn - treat as miss and switch turns
                    handleTurnTimeout(roomId, attackerId);
                    return;
                }
            }
        }

        int row = ((Number) payload.get("row")).intValue();
        int col = ((Number) payload.get("col")).intValue();

        // Initialize attacked cells tracking for this room
        roomAttacksPerPlayer.putIfAbsent(roomId, new ConcurrentHashMap<>());
        Map<String, java.util.Set<String>> attacksByPlayer = roomAttacksPerPlayer.get(roomId);
        attacksByPlayer.putIfAbsent(attackerId, java.util.concurrent.ConcurrentHashMap.newKeySet());
        java.util.Set<String> attackerAttacks = attacksByPlayer.get(attackerId);

        // Check if this cell was already attacked
        String cellKey = row + "," + col;
        // Only consider whether THIS attacker already attacked this cell (each player has their own attack board)
        if (attackerAttacks.contains(cellKey)) {
            log.warn("Player {} tried to attack already attacked cell [{}, {}] in room {}",
                     attackerId, row, col, roomId);

            // Try to find authoritative info in persisted GameState (if available)
            GameState gs = gameStateRepository.findById(roomId).orElse(null);
            String previousAttacker = null;
            Boolean previousIsHit = null;
            if (gs != null) {
                if (gs.getPlayer1Attacks() != null) {
                    for (var a : gs.getPlayer1Attacks()) {
                        int ar = ((Number) a.get("row")).intValue();
                        int ac = ((Number) a.get("col")).intValue();
                        if (ar == row && ac == col) {
                            previousAttacker = gs.getPlayer1Id();
                            previousIsHit = (Boolean) a.get("isHit");
                            break;
                        }
                    }
                }
                if (previousAttacker == null && gs.getPlayer2Attacks() != null) {
                    for (var a : gs.getPlayer2Attacks()) {
                        int ar = ((Number) a.get("row")).intValue();
                        int ac = ((Number) a.get("col")).intValue();
                        if (ar == row && ac == col) {
                            previousAttacker = gs.getPlayer2Id();
                            previousIsHit = (Boolean) a.get("isHit");
                            break;
                        }
                    }
                }
            }

            var errorMessage = new java.util.HashMap<String, Object>();
            errorMessage.put("type", "ATTACK_ERROR");
            errorMessage.put("message", "This cell was already attacked!");
            errorMessage.put("row", row);
            errorMessage.put("col", col);
            if (previousAttacker != null) {
                errorMessage.put("attackedBy", previousAttacker);
            }
            if (previousIsHit != null) {
                errorMessage.put("isHit", previousIsHit);
            }

            messagingTemplate.convertAndSend("/topic/game/" + roomId, errorMessage);
            return;
        }

        // Mark this cell as attacked for this attacker
        attackerAttacks.add(cellKey);

        // Get defender (the other player)
        java.util.List<String> players = roomPlayers.get(roomId);
        String defenderId = players.get(0).equals(attackerId) ? players.get(1) : players.get(0);

        // Get defender's ships
        Map<String, Object> readyPlayers = roomReadyPlayers.get(roomId);
        @SuppressWarnings("unchecked")
        java.util.List<Map<String, Object>> defenderShips =
            (java.util.List<Map<String, Object>>) readyPlayers.get(defenderId);

        // Check if attack hits any ship
        boolean isHit = false;
        if (defenderShips != null) {
            for (Map<String, Object> ship : defenderShips) {
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> positions =
                    (java.util.List<Map<String, Object>>) ship.get("positions");

                if (positions != null) {
                    for (Map<String, Object> pos : positions) {
                        int shipRow = ((Number) pos.get("row")).intValue();
                        int shipCol = ((Number) pos.get("col")).intValue();

                        if (shipRow == row && shipCol == col) {
                            isHit = true;
                            log.info("HIT! Player {} hit {}'s ship at [{}, {}]", attackerId, defenderId, row, col);
                            break;
                        }
                    }
                }
                if (isHit) break;
            }
        }

        // Track hits for victory detection
        if (isHit) {
            roomPlayerHits.putIfAbsent(roomId, new ConcurrentHashMap<>());
            roomPlayerHits.get(roomId).putIfAbsent(attackerId, java.util.concurrent.ConcurrentHashMap.newKeySet());
            roomPlayerHits.get(roomId).get(attackerId).add(cellKey);
        }

        // Broadcast attack result to all players
        Map<String, Object> attackMessage = Map.of(
            "type", "ATTACK",
            "playerId", attackerId,
            "row", row,
            "col", col,
            "isHit", isHit
        );

        messagingTemplate.convertAndSend("/topic/game/" + roomId, attackMessage);

        // Persist attack to database
        persistAttackToGameState(roomId, attackerId, row, col, isHit);

        // Check for victory - count total ship positions for defender
        if (isHit && defenderShips != null) {
            int totalShipCells = 0;
            for (Map<String, Object> ship : defenderShips) {
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> positions =
                    (java.util.List<Map<String, Object>>) ship.get("positions");
                if (positions != null) {
                    totalShipCells += positions.size();
                }
            }

            int attackerHits = roomPlayerHits.get(roomId).get(attackerId).size();
            log.info("Victory check: {} hits out of {} total ship cells", attackerHits, totalShipCells);

            if (attackerHits >= totalShipCells) {
                // VICTORY!
                log.info("🏆 VICTORY! Player {} has destroyed all of {}'s ships!", attackerId, defenderId);

                // Calculate RP for ranked mode
                final Integer winnerRpChange;
                final Integer loserRpChange;

                if ("ranked".equals(gameMode)) {
                    // Get current RP for both players
                    User winner = userRepository.findById(attackerId).orElse(null);
                    User loser = userRepository.findById(defenderId).orElse(null);

                    int winnerCurrentRP = winner != null && winner.getRankingPoints() != null ? winner.getRankingPoints() : 0;
                    int loserCurrentRP = loser != null && loser.getRankingPoints() != null ? loser.getRankingPoints() : 0;

                    // Use RankingUtil to calculate RP changes
                    winnerRpChange = RankingUtil.calculateRPChange(true, winnerCurrentRP, loserCurrentRP);
                    loserRpChange = RankingUtil.calculateRPChange(false, loserCurrentRP, winnerCurrentRP);

                    log.info("Ranked mode RP changes: winner {} (RP: {}) gets +{}, loser {} (RP: {}) gets {}",
                             attackerId, winnerCurrentRP, winnerRpChange, defenderId, loserCurrentRP, loserRpChange);
                } else {
                    winnerRpChange = null;
                    loserRpChange = null;
                }

                persistMatchResult(roomId, attackerId, defenderId, winnerRpChange, loserRpChange);

                Map<String, Object> victoryMessage = Map.of(
                    "type", "GAME_OVER",
                    "winner", attackerId,
                    "loser", defenderId,
                    "message", "All ships destroyed!",
                    "reason", "all_ships_destroyed",
                    "winnerRpChange", winnerRpChange != null ? winnerRpChange : 0,
                    "loserRpChange", loserRpChange != null ? loserRpChange : 0
                );

                messagingTemplate.convertAndSend("/topic/game/" + roomId, victoryMessage);

                // Update game state to finished in database (don't delete it!)
                gameStateRepository.findById(roomId).ifPresent(state -> {
                    state.setGamePhase("finished");
                    state.setWinner(attackerId);
                    state.setLoser(defenderId);
                    state.setWinReason("all_ships_destroyed");
                    state.setGameOverMessage("All ships destroyed!");
                    state.setWinnerRpChange(winnerRpChange);
                    state.setLoserRpChange(loserRpChange);
                    state.setUpdatedAt(Instant.now());
                    gameStateRepository.save(state);
                    log.info("Saved finished game state to database for room {}", roomId);
                });

                // Clean up room data from memory
                roomReadyPlayers.remove(roomId);
                roomPlayers.remove(roomId);
                roomCurrentTurn.remove(roomId);
                roomAttacksPerPlayer.remove(roomId);
                roomPlayerHits.remove(roomId);
                roomGameStart.remove(roomId);
                roomGameMode.remove(roomId);
                roomTurnStartTime.remove(roomId);


                return; // Game is over, don't process turn changes
            }
        }

        // Classic Battleship rule: MISS = lose turn, HIT = keep turn
        if (!isHit) {
            // MISS - change turn to opponent
            String nextPlayer = defenderId;
            roomCurrentTurn.put(roomId, nextPlayer);

            // Reset turn timer for speed mode
            if ("speed".equals(roomGameMode.getOrDefault(roomId, "classic"))) {
                roomTurnStartTime.put(roomId, Instant.now());
            }

            // Update turn in database
            updateCurrentTurnInDatabase(roomId, nextPlayer);

            log.info("MISS! Turn switched from {} to {} in room {}", attackerId, nextPlayer, roomId);

            Map<String, Object> turnMessage = Map.of(
                "type", "TURN_CHANGE",
                "currentPlayer", nextPlayer,
                "previousPlayer", attackerId,
                "reason", "miss"
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, turnMessage);
        } else {
            // HIT - attacker keeps the turn
            // Don't reset timer - timer continues for speed mode
            log.info("HIT! Player {} keeps the turn in room {}", attackerId, roomId);

            Map<String, Object> keepTurnMessage = Map.of(
                "type", "TURN_KEEP",
                "currentPlayer", attackerId,
                "message", "HIT! You get another shot!"
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, keepTurnMessage);
        }
    }

    private void persistAttackToGameState(String roomId, String attackerId, int row, int col, boolean isHit) {
        try {
            GameState gameState = gameStateRepository.findById(roomId).orElse(null);
            if (gameState == null) {
                log.warn("Game state not found for room {} when persisting attack", roomId);
                return;
            }

            // Create attack record
            Map<String, Object> attack = Map.of(
                "row", row,
                "col", col,
                "isHit", isHit
            );

            // Determine which player made the attack
            if (attackerId.equals(gameState.getPlayer1Id())) {
                // Player 1 attacked
                java.util.List<Map<String, Object>> attacks = gameState.getPlayer1Attacks();
                if (attacks == null) {
                    attacks = new java.util.ArrayList<>();
                }
                attacks.add(attack);
                gameState.setPlayer1Attacks(attacks);
            } else {
                // Player 2 attacked
                java.util.List<Map<String, Object>> attacks = gameState.getPlayer2Attacks();
                if (attacks == null) {
                    attacks = new java.util.ArrayList<>();
                }
                attacks.add(attack);
                gameState.setPlayer2Attacks(attacks);
            }

            gameState.setUpdatedAt(Instant.now());
            gameStateRepository.save(gameState);
            log.info("Persisted attack from {} at [{}, {}] to database", attackerId, row, col);
        } catch (Exception e) {
            log.error("Failed to persist attack to database for room {}: {}", roomId, e.getMessage(), e);
        }
    }

    private void updateCurrentTurnInDatabase(String roomId, String playerId) {
        try {
            GameState gameState = gameStateRepository.findById(roomId).orElse(null);
            if (gameState != null) {
                gameState.setCurrentTurn(playerId);
                gameState.setUpdatedAt(Instant.now());

                // Update turn start time for speed mode
                if ("speed".equals(gameState.getGameMode())) {
                    gameState.setTurnStartedAt(Instant.now());
                }

                gameStateRepository.save(gameState);
                log.info("Updated current turn to {} in database for room {}", playerId, roomId);
            }
        } catch (Exception e) {
            log.error("Failed to update turn in database for room {}: {}", roomId, e.getMessage(), e);
        }
    }

    private void handleTurnTimeout(String roomId, String timeoutPlayerId) {
        log.info("⏱️ Turn timeout for player {} in room {}", timeoutPlayerId, roomId);

        // Get opponent
        java.util.List<String> players = roomPlayers.get(roomId);
        if (players == null || players.size() < 2) {
            return;
        }

        String opponentId = players.get(0).equals(timeoutPlayerId) ? players.get(1) : players.get(0);

        // Switch turn to opponent
        roomCurrentTurn.put(roomId, opponentId);
        roomTurnStartTime.put(roomId, Instant.now());

        // Update database
        updateCurrentTurnInDatabase(roomId, opponentId);

        // Notify players
        Map<String, Object> timeoutMessage = Map.of(
            "type", "TURN_TIMEOUT",
            "timedOutPlayer", timeoutPlayerId,
            "currentPlayer", opponentId,
            "message", "Time's up! Turn switched."
        );

        messagingTemplate.convertAndSend("/topic/game/" + roomId, timeoutMessage);
    }

    private void ensureRoomStateLoaded(String roomId) {
        // Check if room state is already in memory
        if (roomReadyPlayers.containsKey(roomId) && !roomReadyPlayers.get(roomId).isEmpty()) {
            return; // Already loaded
        }

        // Try to load from database
        GameState gameState = gameStateRepository.findById(roomId).orElse(null);
        if (gameState != null && gameState.isPlayer1Ready() && gameState.isPlayer2Ready()) {
            log.info("Loading game state from database for room {}", roomId);

            // Initialize memory structures
            roomReadyPlayers.putIfAbsent(roomId, new ConcurrentHashMap<>());
            roomPlayers.putIfAbsent(roomId, new java.util.ArrayList<>());
            roomAttacksPerPlayer.putIfAbsent(roomId, new ConcurrentHashMap<>());
            roomPlayerHits.putIfAbsent(roomId, new ConcurrentHashMap<>());

            Map<String, Object> readyPlayers = roomReadyPlayers.get(roomId);
            java.util.List<String> players = roomPlayers.get(roomId);
            Map<String, java.util.Set<String>> attacksByPlayer = roomAttacksPerPlayer.get(roomId);
            Map<String, java.util.Set<String>> playerHits = roomPlayerHits.get(roomId);

            // Add players and their ships
            if (gameState.getPlayer1Id() != null && gameState.getPlayer1Ships() != null) {
                players.add(gameState.getPlayer1Id());
                readyPlayers.put(gameState.getPlayer1Id(), gameState.getPlayer1Ships());
                playerHits.putIfAbsent(gameState.getPlayer1Id(), java.util.concurrent.ConcurrentHashMap.newKeySet());
            }

            if (gameState.getPlayer2Id() != null && gameState.getPlayer2Ships() != null) {
                players.add(gameState.getPlayer2Id());
                readyPlayers.put(gameState.getPlayer2Id(), gameState.getPlayer2Ships());
                playerHits.putIfAbsent(gameState.getPlayer2Id(), java.util.concurrent.ConcurrentHashMap.newKeySet());
            }

            // Restore attacks per player
            if (gameState.getPlayer1Attacks() != null && gameState.getPlayer1Id() != null) {
                attacksByPlayer.putIfAbsent(gameState.getPlayer1Id(), java.util.concurrent.ConcurrentHashMap.newKeySet());
                java.util.Set<String> p1Set = attacksByPlayer.get(gameState.getPlayer1Id());
                for (Map<String, Object> attack : gameState.getPlayer1Attacks()) {
                    int row = ((Number) attack.get("row")).intValue();
                    int col = ((Number) attack.get("col")).intValue();
                    boolean isHit = (Boolean) attack.get("isHit");
                    String cellKey = row + "," + col;
                    p1Set.add(cellKey);
                    if (isHit) {
                        playerHits.get(gameState.getPlayer1Id()).add(cellKey);
                    }
                }
            }

            if (gameState.getPlayer2Attacks() != null && gameState.getPlayer2Id() != null) {
                attacksByPlayer.putIfAbsent(gameState.getPlayer2Id(), java.util.concurrent.ConcurrentHashMap.newKeySet());
                java.util.Set<String> p2Set = attacksByPlayer.get(gameState.getPlayer2Id());
                for (Map<String, Object> attack : gameState.getPlayer2Attacks()) {
                    int row = ((Number) attack.get("row")).intValue();
                    int col = ((Number) attack.get("col")).intValue();
                    boolean isHit = (Boolean) attack.get("isHit");
                    String cellKey = row + "," + col;
                    p2Set.add(cellKey);
                    if (isHit) {
                        playerHits.get(gameState.getPlayer2Id()).add(cellKey);
                    }
                }
            }

            // Set current turn
            if (gameState.getCurrentTurn() != null) {
                roomCurrentTurn.put(roomId, gameState.getCurrentTurn());
            }

            // Load game mode
            if (gameState.getGameMode() != null) {
                roomGameMode.put(roomId, gameState.getGameMode());
            }

            // Load turn start time for speed mode
            if (gameState.getTurnStartedAt() != null && "speed".equals(gameState.getGameMode())) {
                roomTurnStartTime.put(roomId, gameState.getTurnStartedAt());
            }

            log.info("Successfully loaded game state from database for room {}", roomId);
        }
    }

    private void persistMatchResult(String roomId, String winnerId, String loserId, Integer winnerRp, Integer loserRp) {
        try {
            Instant endTime = Instant.now();
            Instant startTime = roomGameStart.get(roomId);
            Integer durationSeconds = null;
            if (startTime != null) {
                long duration = Duration.between(startTime, endTime).getSeconds();
                if (duration < 0) {
                    duration = 0;
                }
                if (duration > 0 && duration < Integer.MAX_VALUE) {
                    durationSeconds = (int) duration;
                }
            }

            Map<String, java.util.Set<String>> hitsByPlayer = roomPlayerHits.get(roomId);
            int winnerHits = 0;
            int loserHits = 0;
            if (hitsByPlayer != null) {
                java.util.Set<String> winnerSet = hitsByPlayer.get(winnerId);
                java.util.Set<String> loserSet = hitsByPlayer.get(loserId);
                if (winnerSet != null) winnerHits = winnerSet.size();
                if (loserSet != null) loserHits = loserSet.size();
            }

            String winnerScore = winnerHits + "-" + loserHits;
            String loserScore = loserHits + "-" + winnerHits;

            Lobby lobby = lobbyRepository.findById(roomId).orElse(null);
            String mode = lobby != null && lobby.getMode() != null ? lobby.getMode() : "Classic";

            User winner = userRepository.findById(winnerId).orElse(null);
            User loser = userRepository.findById(loserId).orElse(null);

            Match winnerMatch = Match.builder()
                .playerId(winner != null ? winner.getId() : winnerId)
                .playerUsername(winner != null ? winner.getUsername() : winnerId)
                .opponentId(loser != null ? loser.getId() : loserId)
                .opponentUsername(loser != null ? loser.getUsername() : loserId)
                .mode(mode)
                .result("won")
                .score(winnerScore)
                .pointsChange(winnerRp)
                .durationSeconds(durationSeconds)
                .playedAt(endTime)
                .build();

            Match loserMatch = Match.builder()
                .playerId(loser != null ? loser.getId() : loserId)
                .playerUsername(loser != null ? loser.getUsername() : loserId)
                .opponentId(winner != null ? winner.getId() : winnerId)
                .opponentUsername(winner != null ? winner.getUsername() : winnerId)
                .mode(mode)
                .result("lost")
                .score(loserScore)
                .pointsChange(loserRp)
                .durationSeconds(durationSeconds)
                .playedAt(endTime)
                .build();

            matchRepository.saveAll(java.util.List.of(winnerMatch, loserMatch));

            // Update ranking points for ranked mode
            if ("Ranked".equalsIgnoreCase(mode) && winnerRp != null && loserRp != null) {
                if (winner != null) {
                    int currentRP = winner.getRankingPoints() != null ? winner.getRankingPoints() : 0;
                    winner.setRankingPoints(Math.max(0, currentRP + winnerRp));
                    userRepository.save(winner);
                    log.info("Updated winner {} RP: {} -> {}", winnerId, currentRP, winner.getRankingPoints());
                }
                if (loser != null) {
                    int currentRP = loser.getRankingPoints() != null ? loser.getRankingPoints() : 0;
                    loser.setRankingPoints(Math.max(0, currentRP + loserRp));
                    userRepository.save(loser);
                    log.info("Updated loser {} RP: {} -> {}", loserId, currentRP, loser.getRankingPoints());
                }
            }

            log.info("Saved match result for room {} (winner: {}, loser: {})", roomId, winnerId, loserId);
        } catch (Exception e) {
            log.error("Failed to persist match result for room {}: {}", roomId, e.getMessage(), e);
        }
    }

    private void persistMatchResultForForfeit(String roomId, String winnerId, String loserId) {
        try {
            Instant endTime = Instant.now();
            Instant startTime = roomGameStart.get(roomId);
            Integer durationSeconds = null;

            // Calculate duration if game had started
            if (startTime != null) {
                long duration = Duration.between(startTime, endTime).getSeconds();
                if (duration < 0) {
                    duration = 0;
                }
                if (duration > 0 && duration < Integer.MAX_VALUE) {
                    durationSeconds = (int) duration;
                }
            } else {
                // If no start time in memory, try to get from game state creation time
                GameState gameState = gameStateRepository.findById(roomId).orElse(null);
                if (gameState != null && gameState.getCreatedAt() != null) {
                    long duration = Duration.between(gameState.getCreatedAt(), endTime).getSeconds();
                    if (duration > 0 && duration < Integer.MAX_VALUE) {
                        durationSeconds = (int) duration;
                    }
                }
            }

            // Get hit counts if available
            Map<String, java.util.Set<String>> hitsByPlayer = roomPlayerHits.get(roomId);
            int winnerHits = 0;
            int loserHits = 0;
            if (hitsByPlayer != null) {
                java.util.Set<String> winnerSet = hitsByPlayer.get(winnerId);
                java.util.Set<String> loserSet = hitsByPlayer.get(loserId);
                if (winnerSet != null) winnerHits = winnerSet.size();
                if (loserSet != null) loserHits = loserSet.size();
            }

            String winnerScore = winnerHits + "-" + loserHits;
            String loserScore = loserHits + "-" + winnerHits;

            // Get game mode
            Lobby lobby = lobbyRepository.findById(roomId).orElse(null);
            String mode = lobby != null && lobby.getMode() != null ? lobby.getMode() : "Classic";

            // Get user information
            User winner = userRepository.findById(winnerId).orElse(null);
            User loser = userRepository.findById(loserId).orElse(null);

            // Create match records
            Match winnerMatch = Match.builder()
                .playerId(winner != null ? winner.getId() : winnerId)
                .playerUsername(winner != null ? winner.getUsername() : "Unknown")
                .opponentId(loser != null ? loser.getId() : loserId)
                .opponentUsername(loser != null ? loser.getUsername() : "Unknown")
                .mode(mode)
                .result("won")
                .score(winnerScore + " (forfeit)")
                .pointsChange(null)
                .durationSeconds(durationSeconds)
                .playedAt(endTime)
                .build();

            Match loserMatch = Match.builder()
                .playerId(loser != null ? loser.getId() : loserId)
                .playerUsername(loser != null ? loser.getUsername() : "Unknown")
                .opponentId(winner != null ? winner.getId() : winnerId)
                .opponentUsername(winner != null ? winner.getUsername() : "Unknown")
                .mode(mode)
                .result("lost")
                .score(loserScore + " (forfeit)")
                .pointsChange(null)
                .durationSeconds(durationSeconds)
                .playedAt(endTime)
                .build();

            matchRepository.saveAll(java.util.List.of(winnerMatch, loserMatch));

            log.info("✅ Saved forfeit match result for room {} (winner: {}, loser: {})", roomId, winnerId, loserId);
        } catch (Exception e) {
            log.error("❌ Failed to persist forfeit match result for room {}: {}", roomId, e.getMessage(), e);
        }
    }

    @MessageMapping("/game/{roomId}/timeout")
    public void handleTimeout(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        String playerId = (String) payload.get("playerId");
        log.info("⏱️ Timeout received from player {} in room {}", playerId, roomId);

        // Call the existing timeout handler
        handleTurnTimeout(roomId, playerId);
    }

    @MessageMapping("/game/{roomId}/leave")
    public void leaveGame(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        log.info("Player leaving room {}: {}", roomId, payload);

        String leavingPlayerId = (String) payload.get("playerId");

        // Get player username
        User leavingUser = userRepository.findById(leavingPlayerId).orElse(null);
        String leavingPlayerUsername = leavingUser != null ? leavingUser.getUsername() : leavingPlayerId;

        // Check if there's an opponent to declare as winner
        java.util.List<String> players = roomPlayers.get(roomId);
        String remainingPlayerId = null;

        if (players != null && players.size() == 2) {
            // Find the remaining player
            for (String playerId : players) {
                if (!playerId.equals(leavingPlayerId)) {
                    remainingPlayerId = playerId;
                    break;
                }
            }
        }

        // If there's a remaining player, declare them as winner
        if (remainingPlayerId != null) {
            log.info("Player {} left, declaring {} as winner by forfeit", leavingPlayerId, remainingPlayerId);

            // Get game state to check if game was in progress
            GameState gameState = gameStateRepository.findById(roomId).orElse(null);

            // Check if both players were ready (meaning the game actually started)
            boolean gameWasActive = gameState != null &&
                gameState.isPlayer1Ready() &&
                gameState.isPlayer2Ready() &&
                (gameState.getGamePhase().equals("playing") || gameState.getGamePhase().equals("ready"));

            Integer winnerRpChange = null;
            Integer loserRpChange = null;

            if (gameWasActive) {
                log.info("Game was active, saving match result for forfeit in room {}", roomId);
                // Persist the match result (winner by forfeit)
                persistMatchResultForForfeit(roomId, remainingPlayerId, leavingPlayerId);

                // Calculate RP changes for ranked mode
                if (gameState != null && "ranked".equals(gameState.getGameMode())) {
                    User winner = userRepository.findById(remainingPlayerId).orElse(null);
                    User loser = userRepository.findById(leavingPlayerId).orElse(null);

                    int winnerCurrentRP = winner != null && winner.getRankingPoints() != null ? winner.getRankingPoints() : 0;
                    int loserCurrentRP = loser != null && loser.getRankingPoints() != null ? loser.getRankingPoints() : 0;

                    winnerRpChange = RankingUtil.calculateRPChange(true, winnerCurrentRP, loserCurrentRP);
                    loserRpChange = RankingUtil.calculateRPChange(false, loserCurrentRP, winnerCurrentRP);

                    log.info("Forfeit in ranked mode: winner {} gets +{}, loser {} gets {}",
                             remainingPlayerId, winnerRpChange, leavingPlayerId, loserRpChange);
                }
            } else {
                log.info("Game was not fully started yet (both players not ready), not saving match result for room {}", roomId);
            }

            // Notify remaining player of victory
            Map<String, Object> victoryMessage = Map.of(
                "type", "GAME_OVER",
                "winner", remainingPlayerId,
                "loser", leavingPlayerId,
                "reason", "forfeit",
                "message", leavingPlayerUsername + " left the game",
                "winnerRpChange", winnerRpChange != null ? winnerRpChange : 0,
                "loserRpChange", loserRpChange != null ? loserRpChange : 0
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, victoryMessage);

            // Update game state to finished in database (don't delete it!)
            if (gameState != null) {
                gameState.setGamePhase("finished");
                gameState.setWinner(remainingPlayerId);
                gameState.setLoser(leavingPlayerId);
                gameState.setWinReason("forfeit");
                gameState.setGameOverMessage(leavingPlayerUsername + " left the game");
                gameState.setWinnerRpChange(winnerRpChange);
                gameState.setLoserRpChange(loserRpChange);
                gameState.setUpdatedAt(Instant.now());
                gameStateRepository.save(gameState);
                log.info("Saved finished game state (forfeit) to database for room {}", roomId);
            }
        } else {
            // Just notify that player left (no opponent to declare as winner)
            Map<String, Object> leaveMessage = Map.of(
                "type", "PLAYER_LEFT",
                "playerId", leavingPlayerId,
                "username", leavingPlayerUsername
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, leaveMessage);
        }

        // Clean up ready players for this room
        Map<String, Object> readyPlayers = roomReadyPlayers.get(roomId);
        if (readyPlayers != null) {
            readyPlayers.remove(leavingPlayerId);

            // If room is now empty, remove it
            if (readyPlayers.isEmpty()) {
                roomReadyPlayers.remove(roomId);
                roomPlayers.remove(roomId);
                roomCurrentTurn.remove(roomId);
                roomAttacksPerPlayer.remove(roomId);
                roomPlayerHits.remove(roomId);
                roomGameStart.remove(roomId);
                roomGameMode.remove(roomId);
                roomTurnStartTime.remove(roomId);
            }
        }

        // Remove from players list
        if (players != null) {
            players.remove(leavingPlayerId);
        }

        // Don't delete game state - it's already saved as finished above if game was active
        // This allows players to see the game over screen on refresh
    }
}
