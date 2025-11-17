package com.boardship.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document("game_states")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameState {
    @Id
    private String id;

    private String player1Id;
    private String player2Id;

    private String player1Name;
    private String player2Name;

    private String gamePhase; // waiting, placement, ready, playing, finished
    private String currentTurn;

    // Game mode: classic, speed, ranked
    private String gameMode;

    // For speed mode: track when turn started (to enforce time limit)
    private Instant turnStartedAt;

    // For ranked mode: track RP (Ranking Points) changes
    private Integer player1RpChange;
    private Integer player2RpChange;

    // Ship placements for each player
    private List<Map<String, Object>> player1Ships;
    private List<Map<String, Object>> player2Ships;

    // Track if players are ready
    private boolean player1Ready;
    private boolean player2Ready;

    // Track attacks made by each player (on opponent's board)
    // Each attack is a map with: row, col, isHit
    private List<Map<String, Object>> player1Attacks; // Player 1's attacks on Player 2
    private List<Map<String, Object>> player2Attacks; // Player 2's attacks on Player 1

    // Game over information
    private String winner; // User ID of the winner
    private String loser; // User ID of the loser
    private String winReason; // e.g., "all_ships_destroyed", "forfeit", "timeout"
    private String gameOverMessage; // e.g., "PlayerName left the game"
    private Integer winnerRpChange; // RP change for the winner (ranked mode)
    private Integer loserRpChange; // RP change for the loser (ranked mode)

    private Instant createdAt;
    private Instant updatedAt;
}
