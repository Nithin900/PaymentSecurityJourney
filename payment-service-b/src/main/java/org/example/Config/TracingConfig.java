package org.example.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;

@Configuration
public class TracingConfig {

    // NotificationListener runs @Async on another thread; this copies the trace id onto that thread
    // so B's "Notification requested" line and the call to the notification service keep the same trace.
    @Bean
    public TaskDecorator contextPropagatingTaskDecorator() {
        return new ContextPropagatingTaskDecorator();
    }
}
