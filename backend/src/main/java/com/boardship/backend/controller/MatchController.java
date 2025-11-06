package com.boardship.backend.controller;

import com.boardship.backend.model.Match;
import com.boardship.backend.model.User;
import com.boardship.backend.repository.MatchRepository;
import com.boardship.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
}
