package com.example.NotificationService.Controller;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;
import com.example.NotificationService.Service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping
    public NotificationResponse send(@Valid @RequestBody NotificationRequest request) {
        return notificationService.send(request);
    }
}