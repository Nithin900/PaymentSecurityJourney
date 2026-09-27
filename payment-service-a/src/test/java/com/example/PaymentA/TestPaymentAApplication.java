package com.example.PaymentA;

import org.springframework.boot.SpringApplication;

public class TestPaymentAApplication {

	public static void main(String[] args) {
		SpringApplication.from(PaymentAApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
