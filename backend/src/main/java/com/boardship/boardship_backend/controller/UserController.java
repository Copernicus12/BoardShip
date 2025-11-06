package com.boardship.backend.controller;

import com.boardship.backend.model.Match;
import com.boardship.backend.model.User;
import com.boardship.backend.repository.MatchRepository;
import com.boardship.backend.repository.UserRepository;
import com.boardship.backend.util.RankingUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin
public class UserController {

    private final UserRepository userRepository;
    private final MatchRepository matchRepository;

    @GetMapping("/me")
    public ResponseEntity<User> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .map(user -> {
                    // Don't send password to client
                    user.setPassword(null);
                    return ResponseEntity.ok(user);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/online")
    public ResponseEntity<OnlineUsersResponse> getOnlineUsers() {
        var onlineUsers = userRepository.findByStatusIgnoreCase("online");
        var summaries = onlineUsers.stream()
                .map(user -> new UserSummary(
                        user.getId(),
                        user.getUsername(),
                        user.getEmail(),
                        user.getLastSeen()
                ))
                .toList();
        return ResponseEntity.ok(new OnlineUsersResponse(summaries.size(), summaries));
    }

    @GetMapping("/stats")
    public ResponseEntity<UserStatsResponse> getUserStats(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Get all matches for the user
        List<Match> allMatches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId());

        int totalGames = allMatches.size();
        int wins = 0;
        int losses = 0;
        int currentStreak = 0;
        int bestStreak = 0;

        // Calculate basic statistics
        for (Match match : allMatches) {
            String result = match.getResult() != null ? match.getResult().toLowerCase() : "";

            if ("won".equals(result)) {
                wins++;
            } else if ("lost".equals(result)) {
                losses++;
            }
        }

        // Calculate current streak (consecutive wins OR losses from most recent)
        if (!allMatches.isEmpty()) {
            String mostRecentResult = allMatches.get(0).getResult();
            if (mostRecentResult != null && "won".equals(mostRecentResult.toLowerCase())) {
                // Only count current streak if most recent result is a win
                currentStreak = 1;
                for (int i = 1; i < allMatches.size(); i++) {
                    String result = allMatches.get(i).getResult();
                    if (result != null && "won".equals(result.toLowerCase())) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
            // If most recent result is not a win, currentStreak remains 0
        }

        // Calculate best winning streak
        int tempWinStreak = 0;
        for (Match match : allMatches) {
            String result = match.getResult() != null ? match.getResult().toLowerCase() : "";

            if ("won".equals(result)) {
                tempWinStreak++;
                if (tempWinStreak > bestStreak) {
                    bestStreak = tempWinStreak;
                }
            } else {
                tempWinStreak = 0;
            }
        }

        // Calculate win rate
        double winRate = totalGames > 0 ? (double) wins / totalGames * 100 : 0;

        // Get ranking information
        int rankingPoints = user.getRankingPoints() != null ? user.getRankingPoints() : 0;
        RankingUtil.RankInfo rankInfo = RankingUtil.getRankInfo(rankingPoints);

        UserStatsResponse stats = new UserStatsResponse(
                totalGames,
                wins,
                losses,
                Math.round(winRate * 10) / 10.0, // Round to 1 decimal place
                currentStreak,
                bestStreak,
                rankInfo
        );

        return ResponseEntity.ok(stats);
    }

    public record OnlineUsersResponse(long count, java.util.List<UserSummary> users) {}
    public record UserSummary(String id, String username, String email, java.time.Instant lastSeen) {}
    public record UserStatsResponse(
            int totalGames,
            int wins,
            int losses,
            double winRate,
            int currentStreak,
            int bestStreak,
            RankingUtil.RankInfo rankInfo
    ) {}

    @GetMapping("/stats/by-mode")
    public ResponseEntity<StatsByModeResponse> getStatsByMode(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        List<Match> allMatches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId());

        var rankedStats = calculateModeStats(allMatches, "Ranked");
        var classicStats = calculateModeStats(allMatches, "Classic");
        var speedStats = calculateModeStats(allMatches, "Speed");

        return ResponseEntity.ok(new StatsByModeResponse(rankedStats, classicStats, speedStats));
    }

    private ModeStats calculateModeStats(List<Match> allMatches, String mode) {
        var modeMatches = allMatches.stream()
                .filter(m -> mode.equalsIgnoreCase(m.getMode()))
                .toList();

        int total = modeMatches.size();
        int wins = (int) modeMatches.stream()
                .filter(m -> "won".equalsIgnoreCase(m.getResult()))
                .count();
        int losses = (int) modeMatches.stream()
                .filter(m -> "lost".equalsIgnoreCase(m.getResult()))
                .count();
        double winRate = total > 0 ? (double) wins / total * 100 : 0;

        return new ModeStats(mode, total, wins, losses, Math.round(winRate * 10) / 10.0);
    }

    @GetMapping("/opponents/frequent")
    public ResponseEntity<List<FrequentOpponent>> getFrequentOpponents(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        List<Match> allMatches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId());

        // Group by opponent and count
        var opponentStats = new java.util.HashMap<String, OpponentData>();
        for (Match match : allMatches) {
            String opponent = match.getOpponentUsername();
            if (opponent != null) {
                opponentStats.putIfAbsent(opponent, new OpponentData());
                OpponentData data = opponentStats.get(opponent);
                data.totalGames++;
                if ("won".equalsIgnoreCase(match.getResult())) {
                    data.wins++;
                } else if ("lost".equalsIgnoreCase(match.getResult())) {
                    data.losses++;
                }
            }
        }

        // Convert to list and sort by total games
        var frequentOpponents = opponentStats.entrySet().stream()
                .map(entry -> new FrequentOpponent(
                        entry.getKey(),
                        entry.getValue().totalGames,
                        entry.getValue().wins,
                        entry.getValue().losses,
                        entry.getValue().totalGames > 0
                            ? Math.round((double) entry.getValue().wins / entry.getValue().totalGames * 100 * 10) / 10.0
                            : 0
                ))
                .sorted((a, b) -> Integer.compare(b.totalGames(), a.totalGames()))
                .limit(5)
                .toList();

        return ResponseEntity.ok(frequentOpponents);
    }

    @GetMapping("/rank-history")
    public ResponseEntity<List<RankProgressPoint>> getRankHistory(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Get all ranked matches
        List<Match> rankedMatches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId())
                .stream()
                .filter(m -> "Ranked".equalsIgnoreCase(m.getMode()))
                .sorted((a, b) -> a.getPlayedAt().compareTo(b.getPlayedAt())) // Ascending order
                .toList();

        // Calculate RP progression
        var history = new java.util.ArrayList<RankProgressPoint>();
        int currentRP = user.getRankingPoints() != null ? user.getRankingPoints() : 0;

        // Work backwards to calculate historical RP
        for (int i = rankedMatches.size() - 1; i >= 0; i--) {
            Match match = rankedMatches.get(i);
            if (i == rankedMatches.size() - 1) {
                // First match - subtract all subsequent changes
                int totalChange = rankedMatches.stream()
                        .skip(i + 1)
                        .mapToInt(m -> m.getPointsChange() != null ? m.getPointsChange() : 0)
                        .sum();
                currentRP = currentRP - totalChange;
            }

            int rpBefore = currentRP;
            int change = match.getPointsChange() != null ? match.getPointsChange() : 0;
            currentRP += change;

            history.add(new RankProgressPoint(
                    match.getPlayedAt(),
                    rpBefore,
                    currentRP,
                    change,
                    RankingUtil.getRankInfo(currentRP).getRank()
            ));
        }

        return ResponseEntity.ok(history);
    }

    private static class OpponentData {
        int totalGames = 0;
        int wins = 0;
        int losses = 0;
    }

    public record StatsByModeResponse(
            ModeStats ranked,
            ModeStats classic,
            ModeStats speed
    ) {}

    public record ModeStats(
            String mode,
            int totalGames,
            int wins,
            int losses,
            double winRate
    ) {}

    public record FrequentOpponent(
            String username,
            int totalGames,
            int wins,
            int losses,
            double winRate
    ) {}

    public record RankProgressPoint(
            java.time.Instant timestamp,
            int rpBefore,
            int rpAfter,
            int change,
            String rank
    ) {}
}
