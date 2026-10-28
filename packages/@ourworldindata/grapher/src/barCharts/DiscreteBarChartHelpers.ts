import { makePatternId } from "../core/GrapherConstants"

export function makeProjectedDataPatternId(idSuffix?: string): string {
    return makePatternId("DiscreteBarChart_stripes", idSuffix)
}
