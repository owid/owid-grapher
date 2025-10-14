// Pattern IDs should be unique per document (!), not just per grapher instance.
// Including the color in the id guarantees that the pattern uses the correct color,
// even if it gets resolved to a striped pattern of a different grapher instance.
export function makeProjectedDataPatternId(color: string): string {
    return `DiscreteBarChart_stripes_${color}`
}
