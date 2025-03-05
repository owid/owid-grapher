import { MultiDimDimensionChoices } from "@ourworldindata/types"
import { slugify } from "./Util.js"

export function multiDimDimensionsToViewId(
    dimensions: MultiDimDimensionChoices
): string {
    return Object.entries(dimensions)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([_, value]) => slugify(value))
        .join("__")
        .toLowerCase()
}
