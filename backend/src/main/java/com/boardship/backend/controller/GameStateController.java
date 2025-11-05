package com.boardship.backend.controller;

import com.boardship.backend.model.GameState;
import com.boardship.backend.repository.GameStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/game-state")
@RequiredArgsConstructor
@Slf4j
public class GameStateController {

    private final GameStateRepository gameStateRepository;

    @GetMapping("/{roomId}")
    public ResponseEntity<GameState> getGameState(@PathVariable String roomId) {
        log.info("Getting game state for room: {}", roomId);

        return gameStateRepository.findById(roomId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}

