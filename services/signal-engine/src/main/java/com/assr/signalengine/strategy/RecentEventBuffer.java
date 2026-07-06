package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

/** Bounded recent history of raw events, replayed by BacktestService. */
@Component
public class RecentEventBuffer {

    private static final int MAX_SIZE = 200;

    private final ConcurrentLinkedDeque<RawTxLineEvent> buffer = new ConcurrentLinkedDeque<>();

    public void add(RawTxLineEvent event) {
        buffer.addLast(event);
        while (buffer.size() > MAX_SIZE) {
            buffer.pollFirst();
        }
    }

    public List<RawTxLineEvent> recent() {
        return List.copyOf(buffer);
    }
}
