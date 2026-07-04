package com.assr.signalengine.strategy;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Shared odds-snapshot parsing for strategies that read the "books" array
 * shape (see ValueBetDetector/MomentumSignal). Field names are placeholders
 * pending real TxLINE /odds response docs.
 */
public final class TxLinePayloadParser {

    private TxLinePayloadParser() {
    }

    public static JsonNode findBook(JsonNode root, String bookName) {
        JsonNode books = root.get("books");
        if (books == null) {
            return null;
        }
        for (JsonNode book : books) {
            if (bookName.equalsIgnoreCase(book.path("name").asText())) {
                return book;
            }
        }
        return null;
    }
}
