# EC2 Retrieval Backend Checklist

## Before copying files

Use an Ubuntu 24.04 `r7i.xlarge` instance in `ap-south-1` with 100 GiB encrypted gp3 storage. Its security group must expose only ports 22 from your IP and 80/443 publicly. Qdrant port 6333 and retrieval gateway port 8080 must remain private.

## Files to transfer

Transfer the portable source ZIP, then extract it under `/opt/hhgoa-rag`. The current verified Qdrant collection is 51 MiB in its collection directory; the source package intentionally excludes it. Either transfer a Qdrant snapshot of `msmarco_xi_hi_en_mr_v1` separately or rebuild it from the three verified JSONL corpus files using `scripts/build_multilingual_jsonl_qdrant_index.py`.

## EC2 commands after SSH access

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git unzip docker.io docker-compose-plugin
sudo usermod -aG docker $USER
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable
sudo mkdir -p /opt/hhgoa-rag
sudo chown "$USER":"$USER" /opt/hhgoa-rag
```

After logging out and in, extract the ZIP, create `deploy/.env` from `deploy/ec2-retrieval.env.example`, create `/opt/hhgoa-rag/.env` from `deploy/ec2-api.env.example`, restore/rebuild the Qdrant collection, and launch the private retrieval services:

```bash
cd /opt/hhgoa-rag
docker compose --env-file deploy/.env -f deploy/docker-compose.retrieval.yml up -d --build
curl -H "Authorization: Bearer $GATEWAY_TOKEN" http://127.0.0.1:8080/v1/index-status
```

The status response must name `msmarco_xi_hi_en_mr_v1`; for the current partial index expect 8,311 points: Hindi 5,103, English 2,193, Marathi 1,015.

## Protect the public API

Run the Node/tRPC API on loopback port 3000, terminate HTTPS at Caddy or Nginx, and proxy only `api.<your-domain>` to the Node API. The browser must never call Qdrant or the retrieval gateway directly.
