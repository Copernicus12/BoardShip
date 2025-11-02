package com.boardship.backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("lobbies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Lobby {
    @Id
    private String id;
    private String name;
    private String hostId; // user id of host
    private String hostName;
    private String mode;
    private int maxPlayers;
    private int currentPlayers;
    private String status; // waiting, in-progress
    private Instant createdAt;
}

