export type EvalSummaryStatus = "PASS" | "FAIL" | "REVIEW" | "ERROR";

export type EvalSummary = {
  total: number;
  passed: number;
  failed: number;
  review: number;
  error: number;
};

export function calculateEvalSummary(results: Array<{ status: EvalSummaryStatus | string }>): EvalSummary {
  return {
    total: results.length,
    passed: results.filter((item) => item.status === "PASS").length,
    failed: results.filter((item) => item.status === "FAIL").length,
    review: results.filter((item) => item.status === "REVIEW").length,
    error: results.filter((item) => item.status === "ERROR").length,
  };
}

export function assertEvalSummaryConservation(summary: EvalSummary) {
  return summary.total === summary.passed + summary.failed + summary.review + summary.error;
}
