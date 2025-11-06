package com.boardship.backend.controller;

import com.boardship.backend.model.Match;
import com.boardship.backend.model.User;
import com.boardship.backend.repository.MatchRepository;
import com.boardship.backend.repository.UserRepository;
import com.boardship.backend.util.RankingUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
@CrossOrigin
public class LeaderboardController {

    private final UserRepository userRepository;
    private final MatchRepository matchRepository;

    @GetMapping
    public ResponseEntity<List<LeaderboardEntry>> getLeaderboard(
            @RequestParam(name = "limit", defaultValue = "100") int limit,
            @RequestParam(name = "sortBy", defaultValue = "rp") String sortBy) {

        int sanitizedLimit = Math.max(1, Math.min(limit, 500));

        // Get all users
        List<User> allUsers = userRepository.findAll();

        // Build leaderboard entries with statistics
        List<LeaderboardEntry> leaderboard = allUsers.stream()
                .map(user -> {
                    int rp = user.getRankingPoints() != null ? user.getRankingPoints() : 0;
                    RankingUtil.RankInfo rankInfo = RankingUtil.getRankInfo(rp);

                    // Get match statistics for this user
                    List<Match> userMatches = matchRepository.findByPlayerIdOrderByPlayedAtDesc(user.getId());

                    int wins = 0;
                    int losses = 0;

                    for (Match match : userMatches) {
                        String result = match.getResult() != null ? match.getResult().toLowerCase() : "";
                        if ("won".equals(result)) {
                            wins++;
                        } else if ("lost".equals(result)) {
                            losses++;
                        }
                    }

                    int totalGames = wins + losses;
                    double winRate = totalGames > 0 ? (double) wins / totalGames * 100 : 0;

                    return new LeaderboardEntry(
                            user.getUsername(),
                            rp,
                            rankInfo.getRank(),
                            rankInfo.getIcon(),
                            wins,
                            losses,
                            totalGames,
                            Math.round(winRate * 10) / 10.0
                    );
                })
                .sorted((a, b) -> {
                    // Sort based on the sortBy parameter
                    return switch (sortBy.toLowerCase()) {
                        case "wins" -> Integer.compare(b.wins(), a.wins());
                        case "winrate" -> {
                            int rateCompare = Double.compare(b.winRate(), a.winRate());
                            // If win rates are equal, sort by total games
                            yield rateCompare != 0 ? rateCompare : Integer.compare(b.totalGames(), a.totalGames());
                        }
                        default -> Integer.compare(b.score(), a.score()); // Default: sort by RP
                    };
                })
                .limit(sanitizedLimit)
                .toList();

        return ResponseEntity.ok(leaderboard);
    }

    public record LeaderboardEntry(
            String username,
            int score,
            String rank,
            String icon,
            int wins,
            int losses,
            int totalGames,
            double winRate
    ) {}
}

