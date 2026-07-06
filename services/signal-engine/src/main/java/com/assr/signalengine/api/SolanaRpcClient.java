package com.assr.signalengine.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Minimal raw Solana JSON-RPC client — just enough to read program accounts
 * without pulling in a full Solana SDK. Java has no signing role in this
 * system (that's services/execution-client, which already has Anchor); this
 * is read-only.
 */
@Component
public class SolanaRpcClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public SolanaRpcClient(ObjectMapper objectMapper,
                            @Value("${solana.rpc-url:https://api.devnet.solana.com}") String rpcUrl) {
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().baseUrl(rpcUrl).build();
    }

    public record AccountEntry(String pubkey, byte[] data) {
    }

    /**
     * @param discriminatorBase58 the 8-byte Anchor account discriminator, base58-encoded
     * @param agentBase58         filters to accounts whose `agent: Pubkey` field (at byte offset 8) matches
     */
    public List<AccountEntry> getProgramAccountsByAgent(String programIdBase58, String discriminatorBase58,
                                                         String agentBase58) {
        String requestBody = """
                {
                  "jsonrpc": "2.0",
                  "id": 1,
                  "method": "getProgramAccounts",
                  "params": [
                    "%s",
                    {
                      "encoding": "base64",
                      "filters": [
                        {"memcmp": {"offset": 0, "bytes": "%s"}},
                        {"memcmp": {"offset": 8, "bytes": "%s"}}
                      ]
                    }
                  ]
                }
                """.formatted(programIdBase58, discriminatorBase58, agentBase58);

        String response = restClient.post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(String.class);

        List<AccountEntry> results = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode result = root.get("result");
            if (result == null) {
                return results;
            }
            for (JsonNode entry : result) {
                String pubkey = entry.get("pubkey").asText();
                String base64Data = entry.get("account").get("data").get(0).asText();
                results.add(new AccountEntry(pubkey, Base64.getDecoder().decode(base64Data)));
            }
        } catch (Exception e) {
            throw new IllegalStateException("failed to parse getProgramAccounts response", e);
        }
        return results;
    }
}
