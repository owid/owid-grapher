import { makePatternId } from "../core/GrapherConstants"

// Including the color in the id guarantees that each series gets a pattern in its own color
export function makeProjectedDataPatternId(
    color: string,
    idSuffix?: string
): string {
    return makePatternId(`DiscreteBarChart_stripes_${color}`, idSuffix)
}
