package com.boardship.backend.controller;

import com.boardship.backend.dto.*;
import com.boardship.backend.model.User;
import com.boardship.backend.security.JwtService;
import com.boardship.backend.service.AuthService;
import com.boardship.backend.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        User user = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .password(req.getPassword())
                .build();

        User saved = authService.register(user);
        String token = jwtService.generate(saved.getEmail(), saved.getSessionToken());

        return ResponseEntity.ok(new AuthResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        var existing = userRepository.findByEmail(req.getEmail());
        if (existing.isPresent() && authService.hasActiveSession(existing.get())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Account already active on another device. Please log out there or wait a moment."));
        }

        var authenticated = authService.validate(req.getEmail(), req.getPassword());
        if (authenticated.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password"));
        }

        var user = authenticated.get();
        return ResponseEntity.ok(new AuthResponse(jwtService.generate(user.getEmail(), user.getSessionToken())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()) {
            authService.markOffline(authentication.getName());
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/ping")
    public ResponseEntity<Void> ping(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        authService.refreshLastSeen(authentication.getName(), true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/offline")
    public ResponseEntity<Void> goOffline(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        authService.markOffline(authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/test")
    public String test() {
        return "Backend running successfully";
    }
}
