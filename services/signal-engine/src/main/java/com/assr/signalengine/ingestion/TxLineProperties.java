package com.assr.signalengine.ingestion;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "txline")
public class TxLineProperties {

    private String baseUrl;
    private String apiKey;
    private String fixturesPath = "/fixtures";
    private String oddsPath = "/odds";
    private String scoresPath = "/scores";
    private long pollIntervalMs = 60_000;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getFixturesPath() {
        return fixturesPath;
    }

    public void setFixturesPath(String fixturesPath) {
        this.fixturesPath = fixturesPath;
    }

    public String getOddsPath() {
        return oddsPath;
    }

    public void setOddsPath(String oddsPath) {
        this.oddsPath = oddsPath;
    }

    public String getScoresPath() {
        return scoresPath;
    }

    public void setScoresPath(String scoresPath) {
        this.scoresPath = scoresPath;
    }

    public long getPollIntervalMs() {
        return pollIntervalMs;
    }

    public void setPollIntervalMs(long pollIntervalMs) {
        this.pollIntervalMs = pollIntervalMs;
    }
}
