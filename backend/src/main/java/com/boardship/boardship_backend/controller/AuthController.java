package com.boardship.backend.controller;

import com.boardship.backend.dto.*;
import com.boardship.backend.model.User;
import com.boardship.backend.security.JwtService;
import com.boardship.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        User user = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .password(req.getPassword())
                .build();

        User saved = authService.register(user);
        String token = jwtService.generate(saved.getEmail());

        return ResponseEntity.ok(new AuthResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return authService.validate(req.getEmail(), req.getPassword())
                .map(u -> ResponseEntity.ok(new AuthResponse(jwtService.generate(u.getEmail()))))
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    @GetMapping("/test")
    public String test() {
        return "Backend running successfully";
    }
}
