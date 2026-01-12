package com.boardship.backend.controller;

import com.boardship.backend.model.User;
import com.boardship.backend.service.DataSeederService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/seed")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DataSeederController {

    private final DataSeederService dataSeederService;

    /**
     * Seed random users with match history
     * Example: POST /api/admin/seed/users?count=50
     */
    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> seedUsers(@RequestParam(defaultValue = "20") int count) {
        List<User> users = dataSeederService.seedUsers(count);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Successfully seeded " + users.size() + " users");
        response.put("count", users.size());
        response.put("users", users.stream().map(u -> Map.of(
                "username", u.getUsername(),
                "email", u.getEmail(),
                "rankingPoints", u.getRankingPoints()
        )).toList());

        return ResponseEntity.ok(response);
    }

    /**
     * Seed balanced users across skill levels
     * Example: POST /api/admin/seed/balanced?beginners=10&intermediate=10&advanced=10&experts=5
     */
    @PostMapping("/balanced")
    public ResponseEntity<Map<String, Object>> seedBalancedUsers(
            @RequestParam(defaultValue = "10") int beginners,
            @RequestParam(defaultValue = "10") int intermediate,
            @RequestParam(defaultValue = "10") int advanced,
            @RequestParam(defaultValue = "5") int experts
    ) {
        dataSeederService.seedBalancedUsers(beginners, intermediate, advanced, experts);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Successfully seeded balanced users");
        response.put("breakdown", Map.of(
                "beginners", beginners,
                "intermediate", intermediate,
                "advanced", advanced,
                "experts", experts,
                "total", beginners + intermediate + advanced + experts
        ));

        return ResponseEntity.ok(response);
    }

    /**
     * Clear all users and matches (USE WITH CAUTION)
     * Example: DELETE /api/admin/seed/clear
     */
    @DeleteMapping("/clear")
    public ResponseEntity<Map<String, Object>> clearAllData() {
        dataSeederService.clearAllData();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "All users and matches cleared from database");

        return ResponseEntity.ok(response);
    }

    /**
     * Quick seed with default values (50 users)
     * Example: POST /api/admin/seed/quick
     */
    @PostMapping("/quick")
    public ResponseEntity<Map<String, Object>> quickSeed() {
        List<User> users = dataSeederService.seedUsers(50);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Quick seed completed with 50 users");
        response.put("count", users.size());

        return ResponseEntity.ok(response);
    }
}

