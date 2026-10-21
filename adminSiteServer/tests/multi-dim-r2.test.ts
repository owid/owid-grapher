import { describe, it, expect, beforeEach, vi } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    IndicatorsBeforePreProcessing,
    MultiDimDataPagesTableName,
    R2GrapherConfigDirectory,
    View,
} from "@ourworldindata/types"
import {
    catalogPath,
    multiDimConfig,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"
import {
    deleteGrapherConfigFromR2,
    saveMultiDimConfigToR2,
} from "../../serverUtils/r2/chartConfigR2Helpers.js"

vi.mock(
    import("../../serverUtils/r2/chartConfigR2Helpers.js"),
    async (importOriginal) => ({
        ...(await importOriginal()),
        saveMultiDimConfigToR2: vi.fn(async () => undefined),
        deleteGrapherConfigFromR2: vi.fn(async () => undefined),
    })
)

const env = getAdminTestEnv()

describe("Multi-dim configs stored by slug", { timeout: 20000 }, () => {
    const view: View<IndicatorsBeforePreProcessing> = {
        config: { title: "Total energy use" },
        dimensions: { metric: "total" },
        indicators: { y: variableId },
    }

    async function upsertMultiDim(title = "Total energy use"): Promise<void> {
        const config = multiDimConfig([{ ...view, config: { title } }])
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({ config }),
        })
    }

    async function patchMultiDim(body: object): Promise<void> {
        const multiDim = await env
            .testKnex(MultiDimDataPagesTableName)
            .where({ catalogPath })
            .first()
        await env.request({
            method: "PATCH",
            path: `/multi-dims/${multiDim.id}`,
            body: JSON.stringify(body),
        })
    }

    function savedSlugs(): string[] {
        return vi.mocked(saveMultiDimConfigToR2).mock.calls.map(
            ([, slug]) => slug
        )
    }

    beforeEach(async () => {
        vi.clearAllMocks()
        await seedDatasetAndVariables(env)
    })

    it("doesn't store an unpublished multi-dim, even with a slug", async () => {
        await upsertMultiDim()
        await patchMultiDim({ slug: "energy-use" })
        // A changed config pushed from ETL to the unpublished multi-dim.
        await upsertMultiDim("Energy use")

        expect(savedSlugs()).toEqual([])
    })

    it("stores a multi-dim when it is published and removes it when it is unpublished", async () => {
        await upsertMultiDim()
        await patchMultiDim({ slug: "energy-use" })
        vi.clearAllMocks()

        await patchMultiDim({ published: true })
        expect(savedSlugs()).toEqual(["energy-use"])

        // A changed config pushed from ETL keeps the published copy up to date.
        await upsertMultiDim("Energy use")
        expect(savedSlugs()).toEqual(["energy-use", "energy-use"])

        await patchMultiDim({ published: false })
        expect(vi.mocked(deleteGrapherConfigFromR2)).toHaveBeenCalledWith(
            R2GrapherConfigDirectory.multiDim,
            "energy-use.json"
        )
    })
})
