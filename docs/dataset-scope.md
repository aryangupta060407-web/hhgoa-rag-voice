# MSMARCO-XI Dataset Scope

The upstream `ai4bharat/MSMARCO-XI` dataset contains translated query-answer examples together with English and translated passages, query identifiers, query type, original English queries, and original English answers. It is organized into language-specific JSONL files under train and validation folders and is approximately 55.6 GB in total.

The deployed one-day demonstration uses a clearly labelled, representative **offline-built MSMARCO-XI validation slice** rather than attempting to load the full 55.6 GB corpus into a 512 MB managed web container. The application preserves provenance metadata for each embedded passage—dataset name, split, language, query ID, passage ordinal, chunk strategy, and source answer—so the judges can trace every extractive answer to indexed evidence.

The source dataset page is https://huggingface.co/datasets/ai4bharat/MSMARCO-XI.
