# Shared Multilingual Corpus Inventory

The user-provided shared Drive folder named `processed` contains language-specific JSONL corpora and companion long-document files. The files required for the requested first three-language RAG index are present.

| Language | Corpus file | Displayed size | Long-document file |
|---|---|---:|---|
| Hindi | `hi_corpus.jsonl` | 46.1 MB | `hi_longdocs.jsonl` |
| English | `en_corpus.jsonl` | 21.1 MB | `en_longdocs.jsonl` |
| Marathi | `mr_corpus.jsonl` | 48.3 MB | `mr_longdocs.jsonl` |

The folder also contains additional Indic-language corpus files and `rag_sft_dataset.jsonl`. The corpus files are the appropriate deterministic retrieval sources; the SFT dataset is not required for this non-generative RAG implementation.
