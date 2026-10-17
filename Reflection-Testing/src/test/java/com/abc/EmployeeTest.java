package com.abc;

import org.example.Employee;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;

public class EmployeeTest {
   private static Class<?> employee;

   @BeforeAll
   public static void setup()  {
       try {
           employee = Class.forName("org.example.Employee");
       } catch (ClassNotFoundException e) {
           fail(e.getMessage());
       }
   }
   @Test
   public void employeeClassShouldExist() {
       assertNotNull(employee);
   }
}
