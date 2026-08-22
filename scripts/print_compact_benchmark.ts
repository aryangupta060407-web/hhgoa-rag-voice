import { runBenchmarkSuite } from "../server/rag/benchmark";

const report = await runBenchmarkSuite();
console.log(JSON.stringify(report.cases, null, 2));
console.log(JSON.stringify(report.totals, null, 2));
