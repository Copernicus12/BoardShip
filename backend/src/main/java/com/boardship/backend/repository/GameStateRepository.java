package com.boardship.backend.repository;

import com.boardship.backend.model.GameState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GameStateRepository extends MongoRepository<GameState, String> {
    long countByGamePhaseIgnoreCase(String gamePhase);
    long countByGamePhaseNotIgnoreCase(String gamePhase);
    List<GameState> findByGamePhaseNotIgnoreCase(String gamePhase);
}
