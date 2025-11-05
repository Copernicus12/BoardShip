package com.boardship.backend.repository;

import com.boardship.backend.model.Match;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MatchRepository extends MongoRepository<Match, String> {
    List<Match> findByPlayerIdOrderByPlayedAtDesc(String playerId, Pageable pageable);
}
