package com.boardship.backend.controller;

import com.boardship.backend.model.Match;
import com.boardship.backend.model.User;
import com.boardship.backend.repository.MatchRepository;
import com.boardship.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
@CrossOrigin
public class MatchController {

    private final MatchRepository matchRepository;
    private final UserRepository userRepository;

    @GetMapping("/history")
    public ResponseEntity<List<RecentMatchResponse>> getMatchHistory(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        List<Match> matches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId());
        List<RecentMatchResponse> response = matches.stream()
                .map(RecentMatchResponse::fromMatch)
                .toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<RecentMatchResponse>> getRecentMatches(
            Authentication authentication,
            @RequestParam(name = "limit", defaultValue = "5") int limit) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        int sanitizedLimit = Math.max(1, Math.min(limit, 20));
        Pageable pageRequest = PageRequest.of(0, sanitizedLimit);

        List<Match> matches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId(), pageRequest);
        List<RecentMatchResponse> response = matches.stream()
                .map(RecentMatchResponse::fromMatch)
                .toList();

        return ResponseEntity.ok(response);
    }

    // New global recent matches endpoint — public
    @GetMapping("/recent/global")
    public ResponseEntity<List<GlobalRecentMatchResponse>> getRecentMatchesGlobal(
            @RequestParam(name = "limit", defaultValue = "10") int limit) {

        int sanitizedLimit = Math.max(1, Math.min(limit, 50));
        Pageable pageRequest = PageRequest.of(0, sanitizedLimit, Sort.by(Sort.Direction.DESC, "playedAt"));

        var page = matchRepository.findAll(pageRequest);
        List<Match> matches = page.getContent();

        // Deduplicate matches: bucket playedAt into a small window and resolve missing usernames
        final long WINDOW_SECONDS = 5L; // bucket size to tolerate small timestamp diffs
        java.util.Map<String, GlobalRecentMatchResponse> dedup = new java.util.LinkedHashMap<>();

        for (Match m : matches) {
            String idA = m.getPlayerId() != null && !m.getPlayerId().isBlank() ? m.getPlayerId() : null;
            String idB = m.getOpponentId() != null && !m.getOpponentId().isBlank() ? m.getOpponentId() : null;

            String keyA = idA != null ? idA : (m.getPlayerUsername() != null ? m.getPlayerUsername() : "");
            String keyB = idB != null ? idB : (m.getOpponentUsername() != null ? m.getOpponentUsername() : "");
            if (keyA == null) keyA = "";
            if (keyB == null) keyB = "";

            long playedSec = m.getPlayedAt() != null ? m.getPlayedAt().getEpochSecond() : 0L;
            long bucket = playedSec / WINDOW_SECONDS;

            String first = keyA.compareTo(keyB) <= 0 ? keyA : keyB;
            String second = keyA.compareTo(keyB) <= 0 ? keyB : keyA;
            String dedupKey = first + ":" + second + ":" + bucket;

            if (dedup.containsKey(dedupKey)) {
                continue; // already seen
            }

            // Resolve display names if missing
            AtomicReference<String> nameARef = new AtomicReference<>(m.getPlayerUsername());
            AtomicReference<String> nameBRef = new AtomicReference<>(m.getOpponentUsername());
            if ((nameARef.get() == null || nameARef.get().isBlank()) && idA != null) {
                userRepository.findById(idA).ifPresent(u -> nameARef.set(u.getUsername()));
            }
            if ((nameBRef.get() == null || nameBRef.get().isBlank()) && idB != null) {
                userRepository.findById(idB).ifPresent(u -> nameBRef.set(u.getUsername()));
            }
            String nameA = nameARef.get();
            String nameB = nameBRef.get();
            if (nameA == null || nameA.isBlank()) nameA = idA != null && !idA.isBlank() ? idA : "Unknown";
            if (nameB == null || nameB.isBlank()) nameB = idB != null && !idB.isBlank() ? idB : "Unknown";

            GlobalRecentMatchResponse resp = new GlobalRecentMatchResponse(
                    m.getId(),
                    nameA,
                    nameB,
                    m.getMode(),
                    m.getResult(),
                    m.getScore(),
                    m.getPointsChange(),
                    m.getDurationSeconds(),
                    m.getPlayedAt()
            );

            dedup.put(dedupKey, resp);
        }

        List<GlobalRecentMatchResponse> response = dedup.values().stream().toList();

        return ResponseEntity.ok(response);
    }

    public record RecentMatchResponse(
            String id,
            String opponent,
            String mode,
            String result,
            String score,
            Integer pointsChange,
            Integer durationSeconds,
            Instant playedAt
    ) {
        static RecentMatchResponse fromMatch(Match match) {
            return new RecentMatchResponse(
                    match.getId(),
                    match.getOpponentUsername(),
                    match.getMode(),
                    match.getResult(),
                    match.getScore(),
                    match.getPointsChange(),
                    match.getDurationSeconds(),
                    match.getPlayedAt()
            );
        }
    }

    public record GlobalRecentMatchResponse(
            String id,
            String playerA,
            String playerB,
            String mode,
            String result,
            String score,
            Integer pointsChange,
            Integer durationSeconds,
            Instant playedAt
    ) {
        static GlobalRecentMatchResponse fromMatch(Match match) {
            String a = match.getPlayerUsername() != null ? match.getPlayerUsername() : (match.getPlayerId() != null ? match.getPlayerId() : "");
            String b = match.getOpponentUsername() != null ? match.getOpponentUsername() : (match.getOpponentId() != null ? match.getOpponentId() : "");
            return new GlobalRecentMatchResponse(
                    match.getId(),
                    a,
                    b,
                    match.getMode(),
                    match.getResult(),
                    match.getScore(),
                    match.getPointsChange(),
                    match.getDurationSeconds(),
                    match.getPlayedAt()
            );
        }
    }
}
