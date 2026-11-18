import { afterEach, describe, expect, it, vi } from "vitest"
import { DimensionProperty } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { assembleSearchResultData } from "./downloadFunctions.js"
import { RichDataVariant } from "./search/constructSearchResultJson.js"

// The image renderer imports font binaries that Vite can't load in tests
vi.mock(import("./grapherRenderer.js"), () => ({}))

/**
 * The worker reads GrapherState computeds from plain functions with nothing
 * observing them, so MobX would rebuild the base table on every read.
 * assembleSearchResultData has to keep it cached for the whole request,
 * across its async steps, because rebuilding it is the expensive part.
 */
describe(assembleSearchResultData, () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("builds the chart's base table only once per request", async () => {
        const grapherState = new GrapherState({
            selectedEntityNames: ["Brazil", "Argentina"],
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
            ],
        })
        // Load the data after construction, as the worker does
        grapherState.inputTable = SynthesizeGDPTable(
            {
                entityNames: ["Brazil", "Argentina", "Chile", "Peru"],
                timeRange: [2000, 2010],
            },
            12 // seed
        )

        // The entity filter is the last step of GrapherState.table, so each
        // call is one rebuild of a base table. (Map charts call it too,
        // which is why this chart has no map tab.)
        const entityFilterSpy = vi.spyOn(
            OwidTable.prototype,
            "filterByEntityNamesUsingIncludeExcludePattern"
        )

        const result = await assembleSearchResultData(grapherState, {
            variant: RichDataVariant.Medium,
            // Picking a country exercises the async peer selection
            pickedEntities: ["Brazil"],
            numDataTableRowsPerColumn: 4,
            catalogUrl: "",
        })
        expect(result).toBeDefined()

        // Peer selection also builds the table of grapherState.authorsVersion,
        // a separate GrapherState without data, so only count tables with rows
        const filteredTables = entityFilterSpy.mock.contexts as OwidTable[]
        const rebuildsOfChartTable = filteredTables.filter(
            (table) => table.numRows > 0
        )
        expect(rebuildsOfChartTable).toHaveLength(1)
    })
})
