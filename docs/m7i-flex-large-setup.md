# m7i-flex.large Setup for the 8,311-Passage RAG Backend

This runbook deploys the verified partial multilingual collection `msmarco_xi_hi_en_mr_v1` with 8,311 points. It does not claim to deploy a full multi-million-passage corpus.

## 1. Launch the instance

Create an EC2 instance in **Mumbai (`ap-south-1`)** with the following settings.

| Setting | Value |
|---|---|
| Name | `hhgoa-rag-backend` |
| AMI | Ubuntu Server 24.04 LTS, 64-bit x86 |
| Type | `m7i-flex.large` |
| Disk | 100 GiB gp3, encrypted |
| Key | New `.pem` key retained only by you |
| Security group | TCP 22 from your IP; TCP 80/443 from anywhere; no public 6333/8080 |

At the final launch page, review AWS’s cost estimate and launch the instance yourself.

## 2. Copy the source package and connect

From the computer holding your private key and the downloaded project ZIP:

```bash
chmod 400 hhgoa-rag-key.pem
scp -i hhgoa-rag-key.pem HHGoaVoiceRAG-project-source.zip ubuntu@EC2_PUBLIC_IP:/home/ubuntu/
ssh -i hhgoa-rag-key.pem ubuntu@EC2_PUBLIC_IP
```

On the instance:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git unzip docker.io docker-compose-plugin
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable
sudo usermod -aG docker $USER
sudo mkdir -p /opt/hhgoa-rag
sudo unzip /home/ubuntu/HHGoaVoiceRAG-project-source.zip -d /opt/hhgoa-rag
sudo chown -R $USER:$USER /opt/hhgoa-rag
```

Log out and back in once so Docker group membership takes effect.

## 3. Add a small swap file

The `m7i-flex.large` has 8 GiB RAM. Add a 4 GiB swap file as a safety buffer during model loading; it is a fallback, not a substitute for memory.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
free -h
```

## 4. Configure private retrieval services

```bash
cd /opt/hhgoa-rag
cp deploy/ec2-retrieval.env.example deploy/.env
nano deploy/.env
```

Set a long random `GATEWAY_TOKEN` in `deploy/.env`. Keep it private. Start **only Qdrant** before restoring the snapshot:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.retrieval.yml up -d qdrant
```

The Compose file binds Qdrant to `127.0.0.1:6333` and the gateway to `127.0.0.1:8080`; neither service is publicly reachable.

## 5. Restore the Qdrant snapshot

Copy the separately supplied `msmarco_xi_hi_en_mr_v1.snapshot` file to the instance, then upload it to Qdrant after the Qdrant container is running:

```bash
scp -i hhgoa-rag-key.pem msmarco_xi_hi_en_mr_v1.snapshot ubuntu@EC2_PUBLIC_IP:/home/ubuntu/
curl -X POST 'http://127.0.0.1:6333/collections/msmarco_xi_hi_en_mr_v1/snapshots/upload?priority=snapshot' \
  -H 'Content-Type: multipart/form-data' \
  -F 'snapshot=@/home/ubuntu/msmarco_xi_hi_en_mr_v1.snapshot'
```

The verified snapshot is 52,679,680 bytes (approximately 51 MiB). Before upload, confirm its SHA-256 checksum:

```text
9c016e62659c6467e8f3de7d5a407a39b0b2104b7d738f9964acde9d07b0d782
```

On EC2, run `sha256sum /home/ubuntu/msmarco_xi_hi_en_mr_v1.snapshot`; it must match exactly.

Wait for the restore to finish, then confirm Qdrant and the gateway:

```bash
curl http://127.0.0.1:6333/collections/msmarco_xi_hi_en_mr_v1
docker compose --env-file deploy/.env -f deploy/docker-compose.retrieval.yml up -d --build retrieval-gateway
curl -H "Authorization: Bearer $GATEWAY_TOKEN" http://127.0.0.1:8080/v1/index-status
```

The gateway should report the collection name and approximately 8,311 points.

> Validation recorded on 2026-08-22: this exact snapshot was uploaded into a fresh Qdrant 1.19.0 storage directory and restored successfully with `points_count: 8311`.

## 6. Configure and run the Node API

```bash
cp deploy/ec2-api.env.example .env
nano .env
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Set `CORPUS_RETRIEVAL_TOKEN` to the same value as `GATEWAY_TOKEN`. Set `CORS_ALLOWED_ORIGINS` to your Vercel URL. For persistent production operation, create a systemd service for this command and place Caddy or Nginx in front of port 3000.

## 7. Connect Vercel

In Vercel, set `VITE_API_BASE_URL=https://api.your-domain.example`. Do not add any Qdrant, gateway, Sarvam, or database secret to Vercel. Deploy the static frontend, then test an English, Hindi, and Marathi corpus-supported question plus the three personal-question refusals.
