/**
 * Epoch's confidence labels for a training compute estimate, as 90%
 * confidence intervals, from its documentation ("Estimating confidence",
 * https://epoch.ai/data/ai-models-documentation/estimation):
 * Confident ±3×, Likely ±10×, Speculative ±31× (about 0.5, 1 and 1.5 orders
 * of magnitude). The factors are multiplicative, so the interval runs from
 * the estimate divided by the factor to the estimate times it.
 */
export const CONFIDENCE_FACTORS: Record<string, number> = {
    Confident: 3,
    Likely: 10,
    Speculative: 31,
}

/** The 90% range for a model's compute, if its confidence label has one */
export function getComputeRange(
    trainingComputeFlop: number,
    confidence: string | undefined
): [number, number] | undefined {
    const factor = confidence ? CONFIDENCE_FACTORS[confidence] : undefined
    if (!factor) return undefined
    return [trainingComputeFlop / factor, trainingComputeFlop * factor]
}
