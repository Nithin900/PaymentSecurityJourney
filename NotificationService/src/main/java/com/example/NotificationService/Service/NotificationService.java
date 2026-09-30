package com.example.NotificationService.Service;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;

public interface NotificationService {

    NotificationResponse send(NotificationRequest request);
}