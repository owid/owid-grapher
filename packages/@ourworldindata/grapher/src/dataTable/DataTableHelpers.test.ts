import { describe, expect, it } from "vitest"
import { EntityName } from "@ourworldindata/types"
import { groupEntitiesByRegionType } from "../core/RegionGroups"
import { DataTableFilter } from "./DataTableConstants"
import {
    buildDataTableFilterOptions,
    pickDefaultDataTableFilter,
} from "./DataTableHelpers"

const pickDefaultFilterFor = (entityNames: EntityName[]): DataTableFilter => {
    const entitiesByRegionGroup = new Map(
        groupEntitiesByRegionType(entityNames).map(
            ({ regionGroupKey, entityNames }) => [regionGroupKey, entityNames]
        )
    )
    const options = buildDataTableFilterOptions(
        {
            availableEntityNames: entityNames,
            entitiesByRegionGroup,
            selectedEntityNames: [],
        },
        { canFilterBySelection: false }
    )
    return pickDefaultDataTableFilter(options)
}

describe(pickDefaultDataTableFilter, () => {
    it("shows only countries if most entities are countries", () => {
        expect(
            pickDefaultFilterFor(["France", "Germany", "Japan", "Europe"])
        ).toBe("countries")
    })

    it("shows all entities if a single country sits among regions", () => {
        expect(
            pickDefaultFilterFor([
                "Africa (UN)",
                "Asia (UN)",
                "Europe (UN)",
                "Americas (UN)",
                "Nigeria",
            ])
        ).toBe("all")
    })

    it("shows all entities if countries make up exactly half", () => {
        expect(
            pickDefaultFilterFor(["France", "Japan", "Europe", "Asia"])
        ).toBe("all")
    })

    it("counts World toward the entities that aren't countries", () => {
        expect(
            pickDefaultFilterFor(["France", "Japan", "World", "Europe"])
        ).toBe("all")
    })

    it("shows all entities if every entity is a country", () => {
        expect(pickDefaultFilterFor(["France", "Germany", "Japan"])).toBe("all")
    })
})
