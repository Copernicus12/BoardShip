package com.boardship.backend.security;

import com.boardship.backend.repository.UserRepository;
import com.boardship.backend.service.AuthService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AuthService authService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String jwt = authHeader.substring(7);
            Claims claims = jwtService.parse(jwt);
            String userEmail = claims.getSubject();
            String sessionId = claims.get("sid", String.class);

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                userRepository.findByEmail(userEmail).ifPresent(user -> {
                    // validate single active session
                    if (user.getSessionToken() == null || sessionId == null || !sessionId.equals(user.getSessionToken())) {
                        // stale token, refuse auth
                        return;
                    }

                    authService.refreshLastSeen(userEmail, true);

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userEmail,
                            null,
                            new ArrayList<>()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                });
            }
        } catch (Exception e) {
            // Invalid token - just continue without setting authentication
            logger.error("JWT validation error: " + e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
