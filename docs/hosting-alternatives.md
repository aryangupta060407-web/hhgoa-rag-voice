# Hosting Alternatives for the Multilingual RAG Stack

## Bottom line

Use **Vercel free hosting for the static frontend**. For the current 8,311-passage Qdrant index plus the SentenceTransformers multilingual E5 gateway, the only plausible zero-cost backend candidate is an **Oracle Cloud Always Free Arm VM**, subject to account verification and capacity availability. Do not use Render Free or Google Cloud’s always-free micro VM for the retrieval backend.

## Fit comparison

| Provider | Suitable component | Fit for Qdrant + E5 gateway | Reason |
|---|---|---|---|
| Vercel Free | React/Vite frontend | No | Static frontend only; never expose retrieval secrets to the browser. |
| Oracle Cloud Always Free | Node API, Docker, Qdrant, gateway | **Conditional yes** | Oracle lists Always Free Arm compute and block storage, but capacity can be unavailable and idle accounts can be suspended. [1] |
| Render Free | Prototype frontend or light API | No | Free web services have 512 MB RAM, spin down after 15 minutes, have an ephemeral filesystem, and are not for production. [2] |
| Google Cloud always-free e2-micro | Tiny utility or redirect service | No | The always-free Compute Engine option is an e2-micro with limited disk and egress; it is far below the memory needed for Qdrant plus multilingual E5. [3] |
| EC2 `r7i.xlarge` | Full backend | Yes | The practical stable option already prepared in this project; it has 32 GiB RAM, enough headroom for the database and embedding model. |

## Recommended no-cost path

Create an Oracle Cloud Free Tier account, request an Always Free Ampere A1 VM, and allocate the largest Always Free configuration that the console permits. Install Docker, run Qdrant and the gateway privately, and deploy the React frontend to Vercel. If the allocation supplies insufficient RAM or is unavailable, do not force the backend onto a small free host; retain the Vercel frontend and use the EC2 five-day demo plan instead.

Oracle’s Free Tier includes a US$300 trial credit for up to 30 days and Always Free services after the trial, but it requires payment-method verification and notes both capacity constraints and potential suspension of accounts idle for 30 days. [1]

## Deployment boundary

The browser calls the Node/tRPC API only. The API calls the gateway over loopback, and the gateway calls Qdrant privately. Never host Qdrant, the gateway token, or the Sarvam key in Vercel frontend variables.

## References

[1]: https://www.oracle.com/cloud/free/ "Oracle Cloud Free Tier"
[2]: https://render.com/docs/free "Render Deploy for Free"
[3]: https://cloud.google.com/free "Google Cloud Free"
