# Vercel Frontend + EC2 Backend Deployment Runbook

## Architecture

```text
Browser
  → https://<vercel-frontend-domain>
  → https://api.<your-domain>/api/trpc   (HTTPS; CORS restricted)
  → Node/Express app on EC2
  → http://127.0.0.1:8080/v1/retrieve   (private retrieval gateway)
  → Qdrant on the EC2 private Docker network
```

The browser must **not** call Qdrant or the retrieval gateway. The browser calls the EC2 Node API, which holds `CORPUS_RETRIEVAL_TOKEN` and communicates with the private gateway. This preserves the deterministic RAG architecture and prevents leakage of service secrets.

## 1. Prepare EC2

Use the previously recommended 32 GiB machine for the first full index build. Assign a static Elastic IP or a domain name. In the EC2 security group, allow inbound **80/443** from the internet and **22** only from your IP. Do not allow public access to ports 6333 or 8080.

Install Docker, Node.js 22, pnpm, Git, and a reverse proxy such as Caddy or Nginx. Clone the exported repository on the EC2 host.

## 2. Start Qdrant and the retrieval gateway privately

Copy either the three multilingual corpus JSONL files or an existing Qdrant storage snapshot to the EC2 host. If rebuilding, create `msmarco_xi_hi_en_mr_v1` with the repository’s indexer before serving traffic.

Set the retrieval service variables in an EC2-only `.env` file:

```dotenv
QDRANT_COLLECTION=msmarco_xi_hi_en_mr_v1
GATEWAY_TOKEN=<long-random-secret>
DENSE_MODEL=intfloat/multilingual-e5-small
EMBEDDING_BACKEND=sentence-transformers
QUERY_PREFIX=
QDRANT_DENSE_VECTOR_NAME=dense
QDRANT_ENABLE_SPARSE=true
PAYLOAD_TEXT_FIELD=content
PAYLOAD_DOCUMENT_ID_FIELD=queryId
PAYLOAD_LANGUAGE_FIELD=language
```

In the Docker Compose file, bind the gateway only to loopback rather than the public network:

```yaml
ports:
  - "127.0.0.1:8080:8080"
```

Qdrant should remain `expose`-only. Start the two services with:

```bash
docker compose --env-file .env -f deploy/docker-compose.retrieval.yml up -d --build
```

Validate locally on EC2:

```bash
curl -H "Authorization: Bearer $GATEWAY_TOKEN" http://127.0.0.1:8080/v1/index-status
```

For the current verified partial build, expect `msmarco_xi_hi_en_mr_v1`, 8,311 points, and language counts Hindi 5,103, English 2,193, Marathi 1,015.

## 3. Start the Node API backend on EC2

Create an EC2-only `.env` for the Node app:

```dotenv
NODE_ENV=production
PORT=3000
CORPUS_RETRIEVAL_URL=http://127.0.0.1:8080/v1/retrieve
CORPUS_RETRIEVAL_TOKEN=<same-long-random-secret>
CORS_ALLOWED_ORIGINS=https://<your-project>.vercel.app,https://<your-custom-frontend-domain>
SARVAM_API_KEY=<your-sarvam-key>
```

The app already supports the `VITE_API_BASE_URL` frontend variable and restricted CORS. Build and run the API process using systemd, PM2, or a Docker container:

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production node dist/index.js
```

The query-history database is optional for a basic demo because persistence is best-effort. If retained, use a database reachable from EC2 and set `DATABASE_URL`; do not rely on the managed development database outside the Manus environment.

## 4. Put HTTPS in front of the API

Create `api.<your-domain>` pointing to the EC2 Elastic IP. Terminate TLS with Caddy or Nginx and proxy only to the Node app. Example Caddy configuration:

```caddy
api.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

After HTTPS is live, validate from outside EC2:

```bash
curl -X POST 'https://api.example.com/api/trpc/rag.corpusStatus?batch=1' \
  -H 'content-type: application/json' \
  --data '{"0":{"json":null}}'
```

The response must report `mode: external_gateway`, `reachable: true`, and real index metadata.

## 5. Deploy the frontend to Vercel

This repository contains `vercel.json` for the Vite static build. Import the repository into Vercel and use the repository root as the project root.

Set this **Vercel frontend environment variable** for Production, Preview, and Development as appropriate:

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

Do **not** set `CORPUS_RETRIEVAL_TOKEN`, `GATEWAY_TOKEN`, Qdrant credentials, or Sarvam credentials in Vercel’s frontend environment. They are secrets for EC2 only.

Deploy on Vercel. The static frontend will use `VITE_API_BASE_URL` to call `https://api.example.com/api/trpc`.

## 6. Final validation

1. Open the Vercel URL and confirm browser developer tools show calls to `https://api.example.com/api/trpc`, not a local or Manus URL.
2. Confirm the header changes from **7-RECORD DEMO** to the actual external index count.
3. Ask an evidence-supported query in English, Hindi, and Marathi.
4. Ask `What is my name?`, `मेरा नाम क्या है?`, and `माझे नाव काय आहे?`; all three must refuse/no-evidence.
5. Run the 12-case grounding benchmark. It must show its factual and refusal case results.
6. Confirm Qdrant (`6333`) and gateway (`8080`) are not reachable from the public internet.

## Important deployment note

Vercel is a good static frontend host here, but this is no longer a single managed WebDev deployment. You are responsible for EC2 patching, TLS, process restarts, backups, domain DNS, and monitoring. Manus built-in hosting remains available as an alternative for the frontend, but the EC2 backend is appropriate because Qdrant and the Python embedding gateway need Docker and more than the managed app runtime’s memory ceiling.
