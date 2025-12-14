package com.boardship.backend.repository;

import com.boardship.backend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.List;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);
    long countByStatusIgnoreCase(String status);
    long countByStatusIgnoreCaseAndLastSeenAfter(String status, Instant lastSeen);
    List<User> findByStatusIgnoreCaseAndLastSeenBefore(String status, Instant lastSeen);
    List<User> findByStatusIgnoreCase(String status);
    Optional<User> findBySessionToken(String sessionToken);
}
