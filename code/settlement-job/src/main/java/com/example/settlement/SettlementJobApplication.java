package com.example.settlement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling   // turns on @Scheduled in SettlementScheduler
public class SettlementJobApplication {

    public static void main(String[] args) {
        SpringApplication.run(SettlementJobApplication.class, args);
    }
}
