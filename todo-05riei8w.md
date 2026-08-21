# Project TODO

- [x] Assess knowledge-base expansion options that broaden coverage while retaining grounded answers and a sub-200 ms retrieval target.
- [x] Provide a practical phased recommendation, including limits of the “answer every question” goal.
- [x] Verify the Task 2 Hugging Face source and compare its upstream coverage with the application’s bundled corpus.
- [x] Report the verified dataset coverage and its effect on answer breadth.
- [x] Assess full-vector-index scale and the required service separation for the full dataset.
- [x] Provide a phased architecture and latency-validation plan for a lightweight web app and sub-200 ms target.
- [x] Audit the restored retrieval, API, storage, and test implementation and capture its real latency baseline.
- [x] Add a provider-neutral scalable corpus retrieval contract and offline indexing foundation without placing the dataset in the web app.
- [x] Improve deterministic grounding, refusal handling, and detailed critical-path latency instrumentation.
- [x] Update the UI to communicate grounded answers, corpus readiness, source traces, and real latency metrics clearly.
- [x] Add regression and benchmark coverage for in-corpus, out-of-corpus, ambiguous, unsafe, and repeated questions.
- [ ] Connect a real external corpus service and run full-scale validation when its endpoint and credentials are available.
- [x] Assess local and hosted Qdrant plus BM25 deployment options for the HH Goa submission.
- [x] Define the retrieval gateway API contract and exact end-to-end setup steps.
- [x] Recommend the lowest-risk path for the submission without requiring unavailable credentials.
