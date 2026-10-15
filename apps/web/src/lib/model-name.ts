const MODEL_NAMES: Record<string, string> = {
  "meta-models/muse-spark-open": "Meta Muse Spark",
};

/** Human-readable model name for the UI; unknown ids pass through unchanged. */
export function displayModelName(id: string): string {
  return MODEL_NAMES[id] ?? id;
}
