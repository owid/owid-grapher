import * as _ from "lodash-es"
import { useMemo } from "react"

import { MultiDimDimensionChoices } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"

/**
 * Hook that resolves partial settings to complete settings by filling in default values
 * for any missing dimensions.
 */
export function useResolvedSettings(
    settings: MultiDimDimensionChoices,
    dimensions: MultiDimDataPageConfig["dimensions"]
): MultiDimDimensionChoices {
    return useMemo(
        () =>
            _.mapValues(
                dimensions,
                (dim) =>
                    settings[dim.slug] ?? Object.values(dim.choices)[0].slug
            ),
        [settings, dimensions]
    )
}
