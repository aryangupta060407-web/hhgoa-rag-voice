# EC2 Credit Assessment for the Full Multilingual RAG Deployment

## Recommendation

**Yes — US$100 in EC2 credits is enough to complete the full Hindi, English, and Marathi index build and run a credible submission deployment for a limited period.** It is not enough for an always-on production deployment for a full month if the service uses a 32 GiB instance continuously.

The recommended single-machine starting point is **`r7i.xlarge` with 4 vCPUs, 32 GiB RAM, and a 100 GB gp3 EBS volume** in `ap-south-1` (Mumbai). The R7i family is memory optimized and the `r7i.xlarge` size provides 32 GiB, which leaves operating headroom for Qdrant, the SentenceTransformers E5 gateway, and the one-time indexing worker. AWS describes R7i as suitable for memory-intensive database workloads and lists 32 GiB for `r7i.xlarge`. [1]

The application’s complete raw JSONL corpus is 116 MB. The previous 3.8 GiB build environment was terminated while the Python embedding process and Qdrant were running together. The 32 GiB recommendation is deliberately conservative; it should avoid that failure mode and lets the indexer run in bounded batches of 32 records.

## Budget model

| Component | Conservative assumption | Credit impact |
|---|---|---:|
| EC2 during build and serving | `r7i.xlarge`, approximately **US$0.273/hour** in Mumbai | Primary cost |
| EBS | 100 GB gp3, budgeted at **US$10/month** | Persistent cost even when EC2 is stopped |
| Data egress / public IPv4 / logs | Keep a **US$5–10 reserve** | Variable cost |
| Usable compute credit | US$80–85 after storage/reserve | 293–311 hours of `r7i.xlarge` |

At US$0.273/hour, US$90 of compute credit represents about **330 hours, or 13.7 days**, of continuous `r7i.xlarge` runtime. Holding back US$15–20 for EBS and incidental charges still leaves roughly **12–13 days**. Exact regional rates, taxes, public IPv4, and egress should be checked in the AWS Pricing Calculator before launch. AWS bills Linux On-Demand instances per second after a 60-second minimum, while EBS bills provisioned storage until it is released. [2] [3]

## Practical deployment strategy

First, launch the 32 GiB instance, build the complete `msmarco_xi_hi_en_mr_v1` collection, validate `GET /v1/index-status`, and run the benchmark. Do not run the indexer after the initial build unless the corpus changes. Then keep the same host up only for demonstrations, judging, and tests; stop the EC2 instance between those windows. Stopping the instance halts compute charges, but **does not** stop EBS charges.

For a lower-cost serving-only option after successful indexing, test `r7i.large` (16 GiB) or `m7i.xlarge` (16 GiB) against a copied EBS volume. Do **not** rely on 16 GiB for the initial full build: it may work, but it has materially less safety margin for E5, FastEmbed/BM25, Qdrant, and operating-system cache.

## What US$100 will and will not cover

| Objective | Likely outcome with US$100 credits |
|---|---|
| One full index build | **Yes** |
| Submission testing and several demos | **Yes** |
| About 12–14 days of 24/7 32 GiB serving | **Likely, with careful EBS and egress control** |
| A full month of 24/7 32 GiB serving | **No; expect a larger budget** |
| Always-on, highly available production setup with multiple nodes/load balancer | **No** |

## Immediate cost controls

Use one EC2 instance for Qdrant and the gateway; keep Qdrant on the private Docker network; expose only the HTTPS gateway; set a billing alarm at US$50 and US$80; take one EBS snapshot after indexing; and stop the instance whenever it is not being judged or demonstrated. The web UI can remain separately hosted; it only needs `CORPUS_RETRIEVAL_URL` and `CORPUS_RETRIEVAL_TOKEN` to call the gateway.

## References

[1]: https://aws.amazon.com/ec2/instance-types/r7i/ "AWS EC2 R7i instances"
[2]: https://aws.amazon.com/ec2/pricing/on-demand/ "AWS EC2 On-Demand Pricing"
[3]: https://aws.amazon.com/ebs/pricing/ "AWS EBS Pricing"
