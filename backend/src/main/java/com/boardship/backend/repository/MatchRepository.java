package com.boardship.backend.repository;

import com.boardship.backend.model.Match;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface MatchRepository extends MongoRepository<Match, String> {
    List<Match> findByPlayerIdOrderByPlayedAtDesc(String playerId, Pageable pageable);
    List<Match> findByPlayerIdOrderByPlayedAtDesc(String playerId);
    List<Match> findByPlayerIdAndModeOrderByPlayedAtDesc(String playerId, String mode);
    List<Match> findByPlayerIdAndPlayedAtAfterOrderByPlayedAtDesc(String playerId, Instant after);

    @Query("{ 'playerId': ?0 }")
    List<Match> findAllByPlayerId(String playerId);
}
