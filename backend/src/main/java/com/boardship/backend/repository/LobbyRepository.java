package com.boardship.backend.repository;

import com.boardship.backend.model.Lobby;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LobbyRepository extends MongoRepository<Lobby, String> {
    List<Lobby> findByStatus(String status);
    long countByStatus(String status);
    long countByStatusIgnoreCase(String status);
}
