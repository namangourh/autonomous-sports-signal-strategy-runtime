package com.assr.signalengine.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.NoSuchElementException;

@RestController
public class StrategyController {

    private final StrategyRegistry strategyRegistry;
    private final BacktestService backtestService;

    public StrategyController(StrategyRegistry strategyRegistry, BacktestService backtestService) {
        this.strategyRegistry = strategyRegistry;
        this.backtestService = backtestService;
    }

    public record RegisterRequest(String strategyId, String description) {
    }

    @PostMapping("/api/v1/strategy/register")
    public StrategyRegistry.RegisteredStrategy register(@RequestBody RegisterRequest request) {
        return strategyRegistry.register(request.strategyId(), request.description());
    }

    @GetMapping("/api/v1/strategy/registered")
    public Map<String, StrategyRegistry.RegisteredStrategy> registered() {
        return strategyRegistry.all();
    }

    @GetMapping("/api/v1/strategy/{id}/backtest")
    public ResponseEntity<BacktestService.BacktestResult> backtest(@PathVariable String id) {
        try {
            return ResponseEntity.ok(backtestService.run(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
