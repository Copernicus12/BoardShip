package com.boardship.backend.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
@Slf4j
public class GameController {

    private final SimpMessagingTemplate messagingTemplate;

    // Track ready players per room: roomId -> playerId -> ships
    private final Map<String, Map<String, Object>> roomReadyPlayers = new ConcurrentHashMap<>();

    // Track whose turn it is: roomId -> currentPlayerId
    private final Map<String, String> roomCurrentTurn = new ConcurrentHashMap<>();

    // Track all players in a room: roomId -> List<playerId>
    private final Map<String, java.util.List<String>> roomPlayers = new ConcurrentHashMap<>();

    // Track attacked cells per room: roomId -> Set of "row,col" strings
    private final Map<String, java.util.Set<String>> roomAttackedCells = new ConcurrentHashMap<>();

    // Track hit cells per room per player: roomId -> playerId -> Set of "row,col" strings
    private final Map<String, Map<String, java.util.Set<String>>> roomPlayerHits = new ConcurrentHashMap<>();

    @MessageMapping("/game/{roomId}/ready")
    public void playerReady(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        log.info("Player ready in room {}: {}", roomId, payload);

        String playerId = (String) payload.get("playerId");

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
        readyPlayers.put(playerId, payload.get("ships"));

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

            Map<String, Object> startMessage = Map.of(
                "type", "GAME_START",
                "firstPlayer", firstPlayerId,
                "roomId", roomId
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, startMessage);
        }
    }

    @MessageMapping("/game/{roomId}/attack")
    public void attack(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        log.info("Attack in room {}: {}", roomId, payload);

        String attackerId = (String) payload.get("playerId");

        // Validate it's this player's turn
        String currentPlayer = roomCurrentTurn.get(roomId);
        if (currentPlayer == null || !currentPlayer.equals(attackerId)) {
            log.warn("Player {} tried to attack but it's not their turn in room {}", attackerId, roomId);
            return;
        }

        int row = ((Number) payload.get("row")).intValue();
        int col = ((Number) payload.get("col")).intValue();

        // Initialize attacked cells tracking for this room
        roomAttackedCells.putIfAbsent(roomId, java.util.concurrent.ConcurrentHashMap.newKeySet());
        java.util.Set<String> attackedCells = roomAttackedCells.get(roomId);

        // Check if this cell was already attacked
        String cellKey = row + "," + col;
        if (attackedCells.contains(cellKey)) {
            log.warn("Player {} tried to attack already attacked cell [{}, {}] in room {}",
                     attackerId, row, col, roomId);

            Map<String, Object> errorMessage = Map.of(
                "type", "ATTACK_ERROR",
                "message", "This cell was already attacked!",
                "row", row,
                "col", col
            );
            messagingTemplate.convertAndSend("/topic/game/" + roomId, errorMessage);
            return;
        }

        // Mark this cell as attacked
        attackedCells.add(cellKey);

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

                Map<String, Object> victoryMessage = Map.of(
                    "type", "GAME_OVER",
                    "winner", attackerId,
                    "loser", defenderId,
                    "message", "All ships destroyed!"
                );

                messagingTemplate.convertAndSend("/topic/game/" + roomId, victoryMessage);

                // Clean up room data
                roomReadyPlayers.remove(roomId);
                roomPlayers.remove(roomId);
                roomCurrentTurn.remove(roomId);
                roomAttackedCells.remove(roomId);
                roomPlayerHits.remove(roomId);

                return; // Game is over, don't process turn changes
            }
        }

        // Classic Battleship rule: MISS = lose turn, HIT = keep turn
        if (!isHit) {
            // MISS - change turn to opponent
            String nextPlayer = defenderId;
            roomCurrentTurn.put(roomId, nextPlayer);

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
            log.info("HIT! Player {} keeps the turn in room {}", attackerId, roomId);

            Map<String, Object> keepTurnMessage = Map.of(
                "type", "TURN_KEEP",
                "currentPlayer", attackerId,
                "message", "HIT! You get another shot!"
            );

            messagingTemplate.convertAndSend("/topic/game/" + roomId, keepTurnMessage);
        }
    }

    @MessageMapping("/game/{roomId}/leave")
    public void leaveGame(@DestinationVariable String roomId, @RequestBody Map<String, Object> payload) {
        log.info("Player leaving room {}: {}", roomId, payload);

        String playerId = (String) payload.get("playerId");

        // Clean up ready players for this room
        Map<String, Object> readyPlayers = roomReadyPlayers.get(roomId);
        if (readyPlayers != null) {
            readyPlayers.remove(playerId);

            // If room is now empty, remove it
            if (readyPlayers.isEmpty()) {
                roomReadyPlayers.remove(roomId);
                roomPlayers.remove(roomId);
                roomCurrentTurn.remove(roomId);
                roomAttackedCells.remove(roomId);
            }
        }

        // Remove from players list
        java.util.List<String> players = roomPlayers.get(roomId);
        if (players != null) {
            players.remove(playerId);
        }

        // Notify other players
        Map<String, Object> leaveMessage = Map.of(
            "type", "PLAYER_LEFT",
            "playerId", playerId
        );

        messagingTemplate.convertAndSend("/topic/game/" + roomId, leaveMessage);
    }
}

