package com.boardship.backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    private String id;
    private String username;
    private String email;
    private String password;
    private String role;
    private String status; // online/offline
    private Instant lastSeen;
    private String themePreference;

    @Builder.Default
    private Integer rankingPoints = 0; // RP for ranked games
}
