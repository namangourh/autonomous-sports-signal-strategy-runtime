package com.assr.signalengine;

import com.assr.signalengine.ingestion.TxLineProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(TxLineProperties.class)
public class SignalEngineApplication {

    public static void main(String[] args) {
        SpringApplication.run(SignalEngineApplication.class, args);
    }
}
