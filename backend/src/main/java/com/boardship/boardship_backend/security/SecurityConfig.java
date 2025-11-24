package com.boardship.backend.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import org.springframework.http.HttpMethod;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtAuthenticationFilter) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Permităm accesul liber la rutele de autentificare
                        .requestMatchers("/api/auth/**").permitAll()
                        // Allow public GET access to list and fetch lobbies so lobby list + WS info are accessible without auth
                        .requestMatchers(HttpMethod.GET, "/api/lobbies", "/api/lobbies/**").permitAll()
                        // Public recent matches + online count (cover optional trailing slash/params)
                        .requestMatchers(HttpMethod.GET, "/api/matches/recent/global", "/api/matches/recent/global/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/matches/recent/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/online", "/api/users/online/**").permitAll()
                        // Allow authenticated PATCH for join
                        .requestMatchers(HttpMethod.PATCH, "/api/lobbies/*/join").authenticated()
                        // Allow authenticated POST for create
                        .requestMatchers(HttpMethod.POST, "/api/lobbies").authenticated()
                        // Allow authenticated DELETE for lobby deletion
                        .requestMatchers(HttpMethod.DELETE, "/api/lobbies/*").authenticated()
                        // Allow SockJS/WebSocket handshake endpoints
                        .requestMatchers("/ws/**", "/topic/**").permitAll()
                        // All other routes require authentication
                        .anyRequest().authenticated()
                )
                // Add JWT filter before UsernamePasswordAuthenticationFilter
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // dezactivează login-ul clasic / form login-ul implicit
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Allow localhost and any host during development so the frontend served from
        // another machine on the LAN can access the backend. In production restrict this.
        configuration.setAllowedOriginPatterns(Arrays.asList(
                "http://localhost:5173",
                "http://localhost:*",
                "http://127.0.0.1:*",
                "http://192.168.*:*",
                "http://*",
                "https://*"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }


    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
