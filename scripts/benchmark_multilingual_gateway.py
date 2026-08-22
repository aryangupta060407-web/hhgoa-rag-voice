"""Benchmark the deterministic multilingual Qdrant retrieval gateway.

The script measures HTTP retrieval latency only. It deliberately excludes STT and
database persistence so the RAG hot path is separately auditable.
"""
import argparse
import json
import statistics
import time
import urllib.request
from collections import defaultdict


CASES = [
    ("en", "factual", "What was important to the success of the Manhattan Project?"),
    ("en", "factual", "Who led the Manhattan Project?"),
    ("en", "factual", "What did the Manhattan Project develop?"),
    ("en", "unsupported", "What is my name?"),
    ("hi", "factual", "मैनहट्टन परियोजना की सफलता के लिए क्या महत्वपूर्ण था?"),
    ("hi", "factual", "मैनहट्टन परियोजना का नेतृत्व किसने किया?"),
    ("hi", "factual", "मैनहट्टन परियोजना ने क्या बनाया?"),
    ("hi", "unsupported", "मेरा नाम क्या है?"),
    ("mr", "factual", "मॅनहॅटन प्रकल्पाच्या यशासाठी काय महत्त्वाचे होते?"),
    ("mr", "factual", "मॅनहॅटन प्रकल्पाचे नेतृत्व कोणी केले?"),
    ("mr", "factual", "मॅनहॅटन प्रकल्पाने काय विकसित केले?"),
    ("mr", "unsupported", "माझे नाव काय आहे?"),
]


def percentile(values: list[float], p: int) -> float:
    ordered = sorted(values)
    return round(ordered[max(0, int((len(ordered) * p + 99) // 100) - 1)], 3)


def request(url: str, token: str, language: str, query: str) -> tuple[float, dict]:
    payload = json.dumps({"query": query, "language": language, "limit": 3}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"authorization": f"Bearer {token}", "content-type": "application/json"}, method="POST")
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=10) as response:
        result = json.loads(response.read().decode("utf-8"))
    return round((time.perf_counter() - started) * 1000, 3), result


def summarize(values: list[float]) -> dict:
    return {"n": len(values), "p50": percentile(values, 50), "p70": percentile(values, 70), "p95": percentile(values, 95), "p99": percentile(values, 99), "p100": percentile(values, 100), "mean": round(statistics.mean(values), 3)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8080/v1/retrieve")
    parser.add_argument("--token", required=True)
    parser.add_argument("--rounds", type=int, default=7)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    for language, _, query in CASES[:3]:
        request(args.url, args.token, language, query)

    observations = []
    for round_number in range(args.rounds):
        for language, kind, query in CASES:
            elapsed_ms, response = request(args.url, args.token, language, query)
            observations.append({
                "round": round_number + 1,
                "language": language,
                "kind": kind,
                "query": query,
                "httpMs": elapsed_ms,
                "gatewayTimings": response.get("timings", {}),
                "matchCount": len(response.get("matches", [])),
                "firstDocumentId": response.get("matches", [{}])[0].get("documentId") if response.get("matches") else None,
            })

    by_group: dict[str, list[float]] = defaultdict(list)
    for observation in observations:
        by_group["all"].append(observation["httpMs"])
        by_group[f"{observation['language']}_{observation['kind']}"] .append(observation["httpMs"])
        if observation["kind"] == "factual":
            by_group["factual_all_languages"].append(observation["httpMs"])
    report = {
        "benchmark": "local_multilingual_qdrant_gateway",
        "rounds": args.rounds,
        "observations": len(observations),
        "latencyScope": "HTTP retrieval gateway only; excludes STT, browser, and query-history persistence.",
        "percentilesMs": {group: summarize(values) for group, values in by_group.items()},
        "observationsDetail": observations,
    }
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    print(json.dumps({"output": args.output, "percentilesMs": report["percentilesMs"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
