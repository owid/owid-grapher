/** The index of the largest value; the first one on a tie, undefined for no values */
export function argMax(values: readonly number[]): number | undefined {
    let best: number | undefined
    values.forEach((value, i) => {
        if (best === undefined || value > values[best]) best = i
    })
    return best
}
