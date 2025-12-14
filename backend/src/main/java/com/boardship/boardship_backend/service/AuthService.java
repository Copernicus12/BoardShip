package com.boardship.backend.service;

import com.boardship.backend.model.User;
import com.boardship.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public static final long ONLINE_TIMEOUT_SECONDS = 5;
    private static final long REFRESH_MIN_INTERVAL_SECONDS = 20;

    public User register(User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email already exists");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole("USER");
        user.setStatus("online");
        user.setLastSeen(Instant.now());
        user.setSessionToken(UUID.randomUUID().toString());
        return userRepository.save(user);
    }

    public Optional<User> validate(String email, String rawPassword) {
        return userRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(rawPassword, u.getPassword()))
                .map(user -> {
                    user.setStatus("online");
                    user.setLastSeen(Instant.now());
                    user.setSessionToken(UUID.randomUUID().toString()); // invalidate previous sessions
                    return userRepository.save(user);
                });
    }

    public void markOffline(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setStatus("offline");
            user.setLastSeen(Instant.now());
            userRepository.save(user);
        });
    }

    @Scheduled(fixedDelay = 60000)
    public void autoMarkOffline() {
        Instant cutoff = Instant.now().minusSeconds(ONLINE_TIMEOUT_SECONDS);
        java.util.List<User> stale = userRepository.findByStatusIgnoreCaseAndLastSeenBefore("online", cutoff);
        if (!stale.isEmpty()) {
            for (User user : stale) {
                user.setStatus("offline");
            }
            userRepository.saveAll(stale);
        }
    }

    public void refreshLastSeen(String email, boolean ensureOnline) {
        userRepository.findByEmail(email).ifPresent(user -> {
            Instant now = Instant.now();
            Instant lastSeen = user.getLastSeen();

            boolean shouldUpdate = lastSeen == null || now.minusSeconds(REFRESH_MIN_INTERVAL_SECONDS).isAfter(lastSeen);
            if (ensureOnline && !"online".equalsIgnoreCase(user.getStatus())) {
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                user.setLastSeen(now);
                if (ensureOnline) {
                    user.setStatus("online");
                }
                userRepository.save(user);
            }
        });
    }

    public boolean hasActiveSession(User user) {
        if (user == null) return false;
        Instant lastSeen = user.getLastSeen();
        return "online".equalsIgnoreCase(user.getStatus()) &&
                lastSeen != null &&
                lastSeen.isAfter(Instant.now().minusSeconds(ONLINE_TIMEOUT_SECONDS));
    }
}
