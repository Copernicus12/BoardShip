package com.boardship.backend.controller;

import com.boardship.backend.model.GameState;
import com.boardship.backend.model.Lobby;
import com.boardship.backend.repository.GameStateRepository;
import com.boardship.backend.repository.LobbyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.mongodb.client.result.UpdateResult;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import com.boardship.backend.repository.UserRepository;
import com.boardship.backend.model.User;

@RestController
@RequestMapping("/api/lobbies")
@RequiredArgsConstructor
public class LobbyController {

    private final LobbyRepository lobbyRepository;
    private final MongoTemplate mongoTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final GameStateRepository gameStateRepository;

    @GetMapping
    public ResponseEntity<List<Lobby>> listLobbies(@RequestParam(required = false) String status) {
        if (status == null || status.isBlank()) {
            return ResponseEntity.ok(lobbyRepository.findAll());
        }
        return ResponseEntity.ok(lobbyRepository.findByStatus(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Lobby> getLobby(@PathVariable String id) {
        return lobbyRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/stats")
    public ResponseEntity<LobbyStatsResponse> getLobbyStats() {
        long waiting = lobbyRepository.countByStatusIgnoreCase("waiting");
        long inProgressLobbies = lobbyRepository.countByStatusIgnoreCase("in-progress");

        List<GameState> activeStates = gameStateRepository.findByGamePhaseNotIgnoreCase("finished");
        long activeGameCount = activeStates.size();
        long gamesInProgress = Math.max(inProgressLobbies, activeGameCount);

        List<Lobby> allLobbies = lobbyRepository.findAll();

        int playersFromLobbies = allLobbies.stream()
                .mapToInt(lobby -> {
                    Integer current = lobby.getCurrentPlayers();
                    return current != null ? Math.max(0, current) : 0;
                })
                .sum();

        long playersFromActiveGames = activeStates.stream()
                .flatMap(state -> java.util.stream.Stream.of(state.getPlayer1Id(), state.getPlayer2Id()))
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .count();

        Instant now = Instant.now();
        long presenceWindowSeconds = 60;
        Instant presenceThreshold = now.minusSeconds(presenceWindowSeconds);

        List<User> staleUsers = userRepository.findByStatusIgnoreCaseAndLastSeenBefore("online", presenceThreshold);
        if (!staleUsers.isEmpty()) {
            for (User user : staleUsers) {
                user.setStatus("offline");
                user.setLastSeen(now);
            }
            userRepository.saveAll(staleUsers);
        }

        long playersOnline = userRepository.countByStatusIgnoreCase("online");
        if (playersOnline == 0) {
            playersOnline = Math.max(playersFromLobbies, playersFromActiveGames);
        }

        return ResponseEntity.ok(new LobbyStatsResponse(waiting, playersOnline, gamesInProgress));
    }

    @PostMapping
    public ResponseEntity<Lobby> createLobby(@RequestBody Lobby lobby) {
        // set defaults
        if (lobby.getStatus() == null) lobby.setStatus("waiting");
        if (lobby.getCreatedAt() == null) lobby.setCreatedAt(Instant.now());
        if (lobby.getCurrentPlayers() == 0) lobby.setCurrentPlayers(1); // host is in
        if (lobby.getMaxPlayers() == 0) lobby.setMaxPlayers(2);

        Lobby saved = lobbyRepository.save(lobby);
        // broadcast to subscribers
        messagingTemplate.convertAndSend("/topic/lobbies", saved);
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/join")
    public ResponseEntity<?> joinLobby(@PathVariable String id) {
        Optional<Lobby> opt = lobbyRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        Lobby lobby = opt.get();
        if (!"waiting".equalsIgnoreCase(lobby.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Lobby not available");
        }

        if (lobby.getCurrentPlayers() >= lobby.getMaxPlayers()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Lobby full");
        }

        int prev = lobby.getCurrentPlayers();

        Query query = new Query(Criteria.where("_id").is(id).and("currentPlayers").is(prev));
        Update update = new Update().inc("currentPlayers", 1);
        UpdateResult result = mongoTemplate.updateFirst(query, update, Lobby.class);

        if (result.getModifiedCount() == 0) {
            // someone raced or no update applied
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Failed to join lobby (concurrent)");
        }

        Lobby updated = lobbyRepository.findById(id).orElseThrow();
        if (updated.getCurrentPlayers() >= updated.getMaxPlayers()) {
            // set status to in-progress
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(id)), new Update().set("status", "in-progress"), Lobby.class);
            updated = lobbyRepository.findById(id).orElseThrow();
        }

        // broadcast update
        messagingTemplate.convertAndSend("/topic/lobbies", updated);

        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/leave")
    public ResponseEntity<?> leaveLobby(@PathVariable String id) {
        Optional<Lobby> opt = lobbyRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        Lobby lobby = opt.get();

        // Only decrement if currentPlayers > 0
        Query query = new Query(Criteria.where("_id").is(id).and("currentPlayers").gte(1));
        Update update = new Update().inc("currentPlayers", -1);
        UpdateResult result = mongoTemplate.updateFirst(query, update, Lobby.class);

        if (result.getModifiedCount() == 0) {
            // nothing changed (maybe already zero)
            Lobby refreshed = lobbyRepository.findById(id).orElse(null);
            if (refreshed != null) {
                messagingTemplate.convertAndSend("/topic/lobbies", refreshed);
                return ResponseEntity.ok(refreshed);
            }
            return ResponseEntity.status(HttpStatus.CONFLICT).body("No players to remove");
        }

        Lobby updated = lobbyRepository.findById(id).orElseThrow();

        // If lobby was 'in-progress' but now has room, set status back to waiting
        if ("in-progress".equalsIgnoreCase(updated.getStatus()) && updated.getCurrentPlayers() < updated.getMaxPlayers()) {
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(id)), new Update().set("status", "waiting"), Lobby.class);
            updated = lobbyRepository.findById(id).orElseThrow();
        }

        // If there are now 0 players, and the game is finished (or no game state exists), remove the lobby entirely
        if (updated.getCurrentPlayers() == 0) {
            // Try to find a related game state; if none or it's finished, delete the lobby
            Optional<GameState> maybeState = gameStateRepository.findById(id);
            if (maybeState.isEmpty() || "finished".equalsIgnoreCase(maybeState.get().getGamePhase())) {
                // delete and broadcast deletion notice so frontends remove the room
                lobbyRepository.deleteById(id);
                messagingTemplate.convertAndSend("/topic/lobbies", java.util.Map.of("id", id, "deleted", true));
                return ResponseEntity.noContent().build();
            }
        }

        // Broadcast the updated lobby
        messagingTemplate.convertAndSend("/topic/lobbies", updated);

        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLobby(@PathVariable String id) {
        Optional<Lobby> opt = lobbyRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        Lobby lobby = opt.get();

        // Check authenticated user is host
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Not authenticated");
        }

        String principal = auth.getPrincipal().toString();
        // principal is user email (as set in JwtAuthenticationFilter)
        User user = userRepository.findByEmail(principal).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User not found");

        if (!user.getId().equals(lobby.getHostId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only the host can delete the lobby");
        }

        lobbyRepository.deleteById(id);
        // broadcast deletion message
        messagingTemplate.convertAndSend("/topic/lobbies", java.util.Map.of("id", id, "deleted", true));
        return ResponseEntity.noContent().build();
    }

    public record LobbyStatsResponse(long availableGames, long playersOnline, long gamesInProgress) {}
}
