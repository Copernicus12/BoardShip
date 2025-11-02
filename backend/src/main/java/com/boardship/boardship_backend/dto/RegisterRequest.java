package com.boardship.backend.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank private String username;
    @Email @NotBlank private String email;
    @Size(min = 6) private String password;
}