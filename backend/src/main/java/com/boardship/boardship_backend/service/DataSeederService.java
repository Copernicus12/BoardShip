package com.boardship.backend.service;

import com.boardship.backend.model.Match;
import com.boardship.backend.model.User;
import com.boardship.backend.repository.MatchRepository;
import com.boardship.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DataSeederService {
    private final UserRepository userRepository;
    private final MatchRepository matchRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String[] FIRST_NAMES = {
            "Alex", "Maria", "Ion", "Elena", "Andrei", "Ioana", "Mihai", "Ana",
            "George", "Diana", "Cristian", "Laura", "Adrian", "Andreea", "Bogdan",
            "Raluca", "Vlad", "Carmen", "Dan", "Monica", "Florin", "Alina",
            "Stefan", "Irina", "Marius", "Roxana", "Radu", "Gabriela", "Catalin",
            "Simona", "Ciprian", "Daniela", "Iulian", "Bianca", "Razvan", "Oana"
    };

    private static final String[] LAST_NAMES = {
            "Popescu", "Ionescu", "Popa", "Radu", "Dumitrescu", "Munteanu",
            "Stan", "Stoica", "Gheorghe", "Dima", "Constantin", "Oprea",
            "Barbu", "Nistor", "Florea", "Diaconu", "Cristea", "Stanciu",
            "Marin", "Tudor", "Lazar", "Matei", "Rusu", "Ungureanu"
    };

    private static final String[] GAME_MODES = {"ranked", "casual", "blitz"};

    private final Random random = new Random();

    /**
     * Generate multiple users with random match history and ranking points
     *
     * @param count Number of users to create
     * @return List of created users
     */
    public List<User> seedUsers(int count) {
        log.info("Starting to seed {} users with random match history", count);
        List<User> createdUsers = new ArrayList<>();

        for (int i = 0; i < count; i++) {
            try {
                String username = generateUniqueUsername();
                String email = username.toLowerCase() + "@boardship.com";

                // Check if user already exists
                if (userRepository.existsByEmail(email)) {
                    log.warn("User with email {} already exists, skipping", email);
                    continue;
                }

                // Create user with initial RP between 800-1200
                User user = User.builder()
                        .username(username)
                        .email(email)
                        .password(passwordEncoder.encode("password123"))
                        .role("USER")
                        .status("offline")
                        .lastSeen(Instant.now().minus(random.nextInt(7), ChronoUnit.DAYS))
                        .themePreference("dark")
                        .sessionToken(null)
                        .rankingPoints(800 + random.nextInt(400))
                        .build();

                user = userRepository.save(user);
                createdUsers.add(user);

                // Generate random match history for this user
                generateMatchHistory(user);

                log.info("Created user: {} with email: {} and {} RP",
                        user.getUsername(), user.getEmail(), user.getRankingPoints());

            } catch (Exception e) {
                log.error("Error creating user {}: {}", i, e.getMessage());
            }
        }

        log.info("Successfully seeded {} users", createdUsers.size());
        return createdUsers;
    }

    /**
     * Generate random match history for a user
     */
    private void generateMatchHistory(User user) {
        // Random number of matches between 10 and 50
        int matchCount = 10 + random.nextInt(41);
        int currentRP = user.getRankingPoints();

        List<User> allUsers = userRepository.findAll();
        List<User> potentialOpponents = allUsers.stream()
                .filter(u -> !u.getId().equals(user.getId()))
                .toList();

        if (potentialOpponents.isEmpty()) {
            // If no opponents, create some bot opponents
            potentialOpponents = List.of(
                    User.builder().id("bot1").username("Bot_Alpha").build(),
                    User.builder().id("bot2").username("Bot_Beta").build(),
                    User.builder().id("bot3").username("Bot_Gamma").build()
            );
        }

        List<Match> matches = new ArrayList<>();

        for (int i = 0; i < matchCount; i++) {
            User opponent = potentialOpponents.get(random.nextInt(potentialOpponents.size()));

            // Random date within last 60 days
            Instant playedAt = Instant.now().minus(random.nextInt(60), ChronoUnit.DAYS)
                    .minus(random.nextInt(24), ChronoUnit.HOURS);

            // Random result (60% win rate for variety)
            boolean won = random.nextDouble() < 0.6;
            String result = won ? "won" : "lost";

            // Calculate points change based on mode and result
            String mode = GAME_MODES[random.nextInt(GAME_MODES.length)];
            int basePoints = mode.equals("ranked") ? 25 : (mode.equals("blitz") ? 15 : 10);
            int pointsChange = won ?
                    (basePoints + random.nextInt(10)) :
                    -(basePoints + random.nextInt(10));

            if (!mode.equals("ranked")) {
                pointsChange = pointsChange / 2; // Less points for non-ranked
            }

            currentRP += pointsChange;
            currentRP = Math.max(0, currentRP); // Don't go below 0

            // Random score (10-0 to 10-9)
            int playerScore = won ? 10 : random.nextInt(10);
            int opponentScore = won ? random.nextInt(10) : 10;
            String score = playerScore + "-" + opponentScore;

            // Random duration (5-30 minutes)
            int durationSeconds = (5 + random.nextInt(26)) * 60;

            Match match = Match.builder()
                    .playerId(user.getId())
                    .playerUsername(user.getUsername())
                    .opponentId(opponent.getId())
                    .opponentUsername(opponent.getUsername())
                    .mode(mode)
                    .result(result)
                    .score(score)
                    .pointsChange(pointsChange)
                    .durationSeconds(durationSeconds)
                    .playedAt(playedAt)
                    .build();

            matches.add(match);

            // Also create the opponent's perspective of the match
            if (!opponent.getId().startsWith("bot")) {
                Match opponentMatch = Match.builder()
                        .playerId(opponent.getId())
                        .playerUsername(opponent.getUsername())
                        .opponentId(user.getId())
                        .opponentUsername(user.getUsername())
                        .mode(mode)
                        .result(won ? "lost" : "won")
                        .score(opponentScore + "-" + playerScore)
                        .pointsChange(-pointsChange)
                        .durationSeconds(durationSeconds)
                        .playedAt(playedAt)
                        .build();
                matches.add(opponentMatch);
            }
        }

        // Save all matches
        matchRepository.saveAll(matches);

        // Update user's final RP
        user.setRankingPoints(currentRP);
        userRepository.save(user);

        log.info("Generated {} matches for user {}, final RP: {}",
                matchCount, user.getUsername(), currentRP);
    }

    /**
     * Generate a unique username
     */
    private String generateUniqueUsername() {
        String username;
        int attempts = 0;
        do {
            String firstName = FIRST_NAMES[random.nextInt(FIRST_NAMES.length)];
            String lastName = LAST_NAMES[random.nextInt(LAST_NAMES.length)];
            int number = random.nextInt(1000);
            username = firstName + lastName + number;
            attempts++;
        } while (userRepository.existsByUsernameIgnoreCase(username) && attempts < 100);

        if (attempts >= 100) {
            // Fallback to UUID-based username
            username = "User" + UUID.randomUUID().toString().substring(0, 8);
        }

        return username;
    }

    /**
     * Clear all seeded data (users and matches)
     */
    public void clearAllData() {
        log.warn("Clearing all users and matches from database");
        matchRepository.deleteAll();
        userRepository.deleteAll();
        log.info("All data cleared");
    }

    /**
     * Seed a specific number of users with balanced skill levels
     */
    public void seedBalancedUsers(int beginners, int intermediate, int advanced, int experts) {
        log.info("Seeding balanced users: {} beginners, {} intermediate, {} advanced, {} experts",
                beginners, intermediate, advanced, experts);

        seedUsersWithRPRange(beginners, 500, 900);
        seedUsersWithRPRange(intermediate, 900, 1300);
        seedUsersWithRPRange(advanced, 1300, 1700);
        seedUsersWithRPRange(experts, 1700, 2500);
    }

    private void seedUsersWithRPRange(int count, int minRP, int maxRP) {
        for (int i = 0; i < count; i++) {
            try {
                String username = generateUniqueUsername();
                String email = username.toLowerCase() + "@boardship.com";

                if (userRepository.existsByEmail(email)) {
                    continue;
                }

                int initialRP = minRP + random.nextInt(maxRP - minRP);

                User user = User.builder()
                        .username(username)
                        .email(email)
                        .password(passwordEncoder.encode("password123"))
                        .role("USER")
                        .status("offline")
                        .lastSeen(Instant.now().minus(random.nextInt(7), ChronoUnit.DAYS))
                        .themePreference(random.nextBoolean() ? "dark" : "light")
                        .sessionToken(null)
                        .rankingPoints(initialRP)
                        .build();

                user = userRepository.save(user);
                generateMatchHistory(user);

            } catch (Exception e) {
                log.error("Error creating user in range {}-{}: {}", minRP, maxRP, e.getMessage());
            }
        }
    }
}

