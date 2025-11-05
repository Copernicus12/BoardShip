package com.boardship.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

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

    private Instant createdAt;
    private Instant updatedAt;
}
