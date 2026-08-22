"""Print the verified schema and a tiny sample without loading the full parquet file."""

from __future__ import annotations

from pathlib import Path

import pyarrow.parquet as pq


if __name__ == "__main__":
    path = Path("/home/ubuntu/msmarco-xi-data/hinval.parquet")
    source = pq.ParquetFile(path)
    print("columns:", source.schema.names)
    print("rows:", source.metadata.num_rows)
    sample = next(source.iter_batches(batch_size=3))
    print(sample.to_pylist())
