# Connect the 8,311-Passage Qdrant Index to the Web App

The web app never connects directly to Qdrant. Its server calls a protected retrieval gateway, and the gateway calls Qdrant. This preserves the gateway token and keeps the vector database private.

> **Current state:** The verified collection is `msmarco_xi_hi_en_mr_v1`, with 8,311 points. Its local storage directory is `/home/ubuntu/user-qdrant-restore/qdrant_storage`. The app preview is currently in `compact_local` mode until the two `CORPUS_RETRIEVAL_*` server variables are configured.

## A. Temporary same-sandbox preview test

This is only for testing while the local sandbox remains awake. It is not a public or durable deployment.

1. Start Qdrant against the verified storage directory:

   ```bash
   QDRANT__STORAGE__STORAGE_PATH=/home/ubuntu/user-qdrant-restore/qdrant_storage \
     /home/ubuntu/qdrant-local/qdrant
   ```

2. In a second terminal, start the gateway with the exact index configuration:

   ```bash
   cd /home/ubuntu/hhgoa-rag-voice/services/retrieval-gateway
   QDRANT_URL=http://127.0.0.1:6333 \
   QDRANT_COLLECTION=msmarco_xi_hi_en_mr_v1 \
   QDRANT_DENSE_VECTOR_NAME=dense \
   QDRANT_ENABLE_SPARSE=true \
   PAYLOAD_TEXT_FIELD=content \
   PAYLOAD_DOCUMENT_ID_FIELD=queryId \
   PAYLOAD_LANGUAGE_FIELD=language \
   EMBEDDING_BACKEND=sentence-transformers \
   DENSE_MODEL=intfloat/multilingual-e5-small \
   QUERY_PREFIX='' \
   GATEWAY_TOKEN='<use-a-long-random-secret>' \
   uvicorn app:app --host 127.0.0.1 --port 8080
   ```

3. Verify the gateway returns the real collection metadata:

   ```bash
   curl -H 'Authorization: Bearer <same-secret>' http://127.0.0.1:8080/v1/index-status
   ```

   Expected values are `indexVersion: msmarco_xi_hi_en_mr_v1`, `pointsCount: 8311`, and the language counts Hindi 5,103, English 2,193, Marathi 1,015.

4. Set the following **server-only** web-app variables, then restart the preview server:

   | Variable | Temporary preview value |
   |---|---|
   | `CORPUS_RETRIEVAL_URL` | `http://127.0.0.1:8080/v1/retrieve` |
   | `CORPUS_RETRIEVAL_TOKEN` | The exact `GATEWAY_TOKEN` from step 2 |

   These values must be configured through the project’s secure environment-variable settings, not committed to source control and never put in `VITE_*` variables.

5. Refresh the app. The header should change from **“7-RECORD DEMO”** to **“8,311 INDEXED”** and the page should show `gateway · msmarco_xi_hi_en_mr_v1` after a successful query.

## B. Durable EC2 connection path

Use this path for the submission or any publicly accessible deployment.

1. Provision an EC2 host with at least 32 GiB RAM for the initial build or restoration. Keep Qdrant private; expose only the gateway over HTTPS.
2. Copy the verified storage directory to the host, for example `/opt/hhgoa/qdrant_storage`. Alternatively, copy the three JSONL files and rebuild with `scripts/build_multilingual_jsonl_qdrant_index.py`.
3. Run Qdrant with `/opt/hhgoa/qdrant_storage` mounted at `/qdrant/storage`, so it loads `msmarco_xi_hi_en_mr_v1` on startup.
4. Run the retrieval gateway with the same environment values shown above, but set `QDRANT_URL=http://qdrant:6333` when both containers share the Docker network.
5. Assign the gateway a public HTTPS URL, for example `https://rag.example.org/v1/retrieve`, and retain a long random `GATEWAY_TOKEN` only on the gateway and web-app server.
6. Configure the web app’s secure server variables:

   | Variable | Durable deployment value |
   |---|---|
   | `CORPUS_RETRIEVAL_URL` | `https://rag.example.org/v1/retrieve` |
   | `CORPUS_RETRIEVAL_TOKEN` | The same gateway secret |

7. Restart the web app, call the `rag.corpusStatus` procedure or refresh the page, and require `mode: external_gateway`, `reachable: true`, and the real 8,311 point count before presenting the app.

## Security and validation checklist

- Do not expose Qdrant port `6333` publicly.
- Do not put the gateway token in the browser, UI source code, or a `VITE_*` variable.
- Require `Authorization: Bearer <token>` on the gateway.
- Test one factual query in each language plus `What is my name?`, `मेरा नाम क्या है?`, and `माझे नाव काय आहे?`; the personal questions must return no evidence.
- Run the in-app 12-case grounding benchmark after the connection changes. It should show the external collection in the response badge and should retain refusal behavior for unsupported/adversarial cases.
