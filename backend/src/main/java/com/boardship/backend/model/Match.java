package com.boardship.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("matches")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Match {
    @Id
    private String id;

    private String playerId;
    private String playerUsername;

    private String opponentId;
    private String opponentUsername;

    private String mode;
    /**
     * Store as lowercase (`won` / `lost`) for easier client-side styling.
     */
    private String result;
    private String score;
    private Integer pointsChange;
    private Integer durationSeconds;
    private Instant playedAt;
}
