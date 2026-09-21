import { expect, it } from "vitest"
import * as R from "remeda"
import { customRegionDisplayOrder, getRegionsForKey } from "./RegionTooltipData"

it.each(R.entries(customRegionDisplayOrder))(
    "orders every region of %s exactly once",
    (key, displayOrder) => {
        const names = getRegionsForKey(key).map((region) => region.name)
        expect(new Set(displayOrder)).toEqual(new Set(names))
        expect(displayOrder).toHaveLength(names.length)
    }
)
