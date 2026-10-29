import { expect, it, describe, vi } from "vitest"

import * as _ from "lodash-es"
import {
    DimensionProperty,
    GrapherInterface,
    MapRegionName,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import {
    mergeGrapherConfigs,
    diffGrapherConfigs,
} from "./grapherConfigInheritance.js"

const SCHEMA_URL =
    "https://files.ourworldindata.org/schemas/grapher-schema.011.json"
const OUTDATED_SCHEMA_URL =
    "https://files.ourworldindata.org/schemas/grapher-schema.010.json"

describe(mergeGrapherConfigs, () => {
    it("merges empty configs", () => {
        expect(mergeGrapherConfigs({}, {})).toEqual({})
        expect(mergeGrapherConfigs({ title: "Parent title" }, {})).toEqual({
            title: "Parent title",
        })
        expect(mergeGrapherConfigs({}, { title: "Child title" })).toEqual({
            title: "Child title",
        })
    })

    it("doesn't mutate input objects", () => {
        const parentConfig = { $schema: SCHEMA_URL, title: "Title" }
        const childConfig = { $schema: SCHEMA_URL, subtitle: "Subtitle" }
        mergeGrapherConfigs(parentConfig, childConfig)
        expect(parentConfig).toEqual({ $schema: SCHEMA_URL, title: "Title" })
        expect(childConfig).toEqual({
            $schema: SCHEMA_URL,
            subtitle: "Subtitle",
        })
    })

    it("merges two objects", () => {
        expect(
            mergeGrapherConfigs(
                { $schema: SCHEMA_URL, title: "Parent title" },
                { $schema: SCHEMA_URL, subtitle: "Child subtitle" }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            title: "Parent title",
            subtitle: "Child subtitle",
        })
        expect(
            mergeGrapherConfigs(
                { $schema: SCHEMA_URL, title: "Parent title" },
                { $schema: SCHEMA_URL, title: "Child title" }
            )
        ).toEqual({ $schema: SCHEMA_URL, title: "Child title" })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                {
                    $schema: SCHEMA_URL,
                    title: "Child title",
                    hideRelativeToggle: true,
                }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            title: "Child title",
            subtitle: "Parent subtitle",
            hideRelativeToggle: true,
        })
    })

    it("merges three objects", () => {
        expect(
            mergeGrapherConfigs(
                { $schema: SCHEMA_URL, title: "Parent title" },
                { $schema: SCHEMA_URL, subtitle: "Child subtitle" },
                { $schema: SCHEMA_URL, note: "Grandchild note" }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            title: "Parent title",
            subtitle: "Child subtitle",
            note: "Grandchild note",
        })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                    sourceDesc: "Parent sources",
                },
                {
                    $schema: SCHEMA_URL,
                    title: "Child title",
                    subtitle: "Child subtitle",
                },
                {
                    $schema: SCHEMA_URL,
                    title: "Grandchild title",
                    note: "Grandchild note",
                }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            title: "Grandchild title",
            subtitle: "Child subtitle",
            note: "Grandchild note",
            sourceDesc: "Parent sources",
        })
    })

    it("merges nested objects", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    map: {
                        region: MapRegionName.World,
                        time: 2000,
                    },
                },
                {
                    $schema: SCHEMA_URL,
                    map: {
                        region: MapRegionName.Africa,
                        hideTimeline: true,
                    },
                }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            map: {
                region: MapRegionName.Africa,
                time: 2000,
                hideTimeline: true,
            },
        })
    })

    it("overwrites arrays", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    selectedEntityNames: ["France", "Italy"],
                },
                { $schema: SCHEMA_URL, selectedEntityNames: ["Italy", "Spain"] }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            selectedEntityNames: ["Italy", "Spain"],
        })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    colorScale: { customNumericValues: [1, 2] },
                },
                {
                    $schema: SCHEMA_URL,
                    colorScale: { customNumericValues: [3, 4] },
                }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            colorScale: { customNumericValues: [3, 4] },
        })
    })

    it("warns when merging configs without schema information", () => {
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(_.noop)

        expect(
            mergeGrapherConfigs({ title: "Title A" }, { title: "Title B" })
        ).toEqual({ title: "Title B" })

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("missing schema information")
        )
        consoleWarnSpy.mockRestore()
    })

    it("warns when merging configs of different schema versions", () => {
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(_.noop)

        expect(
            mergeGrapherConfigs(
                { $schema: OUTDATED_SCHEMA_URL, title: "Title A" },
                { $schema: SCHEMA_URL, title: "Title B" }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            title: "Title B",
        })

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("different schema versions")
        )
        consoleWarnSpy.mockRestore()
    })

    it("excludes id, slug, version and isPublished from inheritance", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                { $schema: SCHEMA_URL, title: "Title B" }
            )
        ).toEqual({ $schema: SCHEMA_URL, title: "Title B" })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                {
                    $schema: SCHEMA_URL,
                    slug: "child-slug",
                    version: 1,
                    title: "Title B",
                }
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            slug: "child-slug",
            version: 1,
            title: "Title B",
        })
    })

    it("ignores empty objects", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                {
                    $schema: SCHEMA_URL,
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                {}
            )
        ).toEqual({
            $schema: SCHEMA_URL,
            id: 1,
            slug: "parent-slug",
            version: 1,
            title: "Title A",
            subtitle: "Parent subtitle",
        })
    })

    it("overwrites values with an empty string if requested", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: SCHEMA_URL,
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                { $schema: SCHEMA_URL, subtitle: "" }
            )
        ).toEqual({ $schema: SCHEMA_URL, title: "Parent title", subtitle: "" })
    })

    it("is associative", () => {
        const configA: GrapherInterface = {
            $schema: SCHEMA_URL,
            title: "Title A",
            subtitle: "Subtitle A",
        }
        const configB: GrapherInterface = {
            $schema: SCHEMA_URL,
            title: "Title B",
            note: "Note B",
        }
        const configC: GrapherInterface = {
            $schema: SCHEMA_URL,
            title: "Title C",
            subtitle: "Subtitle C",
            sourceDesc: "Source C",
        }
        expect(
            mergeGrapherConfigs(configA, mergeGrapherConfigs(configB, configC))
        ).toEqual(
            mergeGrapherConfigs(mergeGrapherConfigs(configA, configB), configC)
        )
        expect(
            mergeGrapherConfigs(mergeGrapherConfigs(configA, configB), configC)
        ).toEqual(mergeGrapherConfigs(configA, configB, configC))
    })
})

describe(diffGrapherConfigs, () => {
    it("returns the given config if the reference is empty", () => {
        expect(diffGrapherConfigs({ title: "Chart" }, {})).toEqual({
            title: "Chart",
        })
    })

    it("returns the given config if it's empty", () => {
        expect(diffGrapherConfigs({}, { title: "Reference chart" })).toEqual({})
    })

    it("drops redundant entries", () => {
        expect(
            diffGrapherConfigs(
                { tab: GRAPHER_TAB_CONFIG_OPTIONS.map },
                { tab: GRAPHER_TAB_CONFIG_OPTIONS.map }
            )
        ).toEqual({})
        expect(
            diffGrapherConfigs(
                { tab: GRAPHER_TAB_CONFIG_OPTIONS.chart, title: "Chart" },
                {
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    title: "Reference chart",
                }
            )
        ).toEqual({ title: "Chart" })
    })

    it("diffs nested configs correctly", () => {
        expect(
            diffGrapherConfigs(
                {
                    title: "Chart",
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    map: {
                        region: MapRegionName.World,
                        hideTimeline: true,
                    },
                },
                {
                    title: "Reference chart",
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    map: {
                        region: MapRegionName.World,
                        hideTimeline: false,
                    },
                }
            )
        ).toEqual({ title: "Chart", map: { hideTimeline: true } })
        expect(
            diffGrapherConfigs(
                {
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    map: {
                        region: MapRegionName.World,
                        hideTimeline: true,
                    },
                },
                {
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    map: {
                        region: MapRegionName.World,
                        hideTimeline: true,
                    },
                }
            )
        ).toEqual({})
    })

    it("strips undefined values from the config", () => {
        expect(
            diffGrapherConfigs(
                {
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    title: "Chart",
                    subtitle: undefined,
                },
                {
                    tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
                    title: "Reference chart",
                }
            )
        ).toEqual({ title: "Chart" })
    })

    it("strips empty objects from the config", () => {
        expect(diffGrapherConfigs({ map: {} }, {})).toEqual({})
        expect(
            diffGrapherConfigs(
                { map: { colorScale: { customCategoryColors: {} } } },
                { map: { colorScale: { colorSchemeInvert: false } } }
            )
        ).toEqual({})
    })

    it("doesn't diff $schema, id, version, slug or isPublished", () => {
        expect(
            diffGrapherConfigs(
                {
                    title: "Chart",
                    $schema: SCHEMA_URL,
                    id: 20,
                    version: 1,
                    slug: "slug",
                    isPublished: false,
                    dimensions: [
                        { property: DimensionProperty.y, variableId: 123456 },
                    ],
                },
                {
                    title: "Reference chart",
                    $schema: SCHEMA_URL,
                    id: 20,
                    version: 1,
                    slug: "slug",
                    isPublished: false,
                    dimensions: [
                        { property: DimensionProperty.y, variableId: 123456 },
                    ],
                }
            )
        ).toEqual({
            title: "Chart",
            $schema: SCHEMA_URL,
            id: 20,
            version: 1,
            slug: "slug",
            isPublished: false,
        })
    })

    it("diffs dimensions like any other inherited property", () => {
        const dimensions = [
            { property: DimensionProperty.y, variableId: 123456 },
        ]

        // identical to the reference: falls through to the parent stack
        expect(diffGrapherConfigs({ dimensions }, { dimensions })).toEqual({})

        // a genuine override: survives in the patch
        expect(
            diffGrapherConfigs(
                {
                    dimensions: [
                        { property: DimensionProperty.y, variableId: 999 },
                    ],
                },
                { dimensions }
            )
        ).toEqual({
            dimensions: [{ property: DimensionProperty.y, variableId: 999 }],
        })

        // absent from the reference: kept, nothing to inherit from
        expect(diffGrapherConfigs({ dimensions }, {})).toEqual({ dimensions })
    })

    it("drops only the nested fields that match the reference", () => {
        expect(
            diffGrapherConfigs(
                { yAxis: { min: 0, max: 100 } },
                { yAxis: { min: 0 } }
            )
        ).toEqual({ yAxis: { max: 100 } })
    })

    it("is idempotent", () => {
        const config: GrapherInterface = {
            tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
            title: "Chart",
            subtitle: undefined,
        }
        const reference: GrapherInterface = {
            tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
            title: "Reference chart",
        }
        const diffedOnce = diffGrapherConfigs(config, reference)
        const diffedTwice = diffGrapherConfigs(diffedOnce, reference)
        expect(diffedTwice).toEqual(diffedOnce)
    })
})

describe("diff+merge", () => {
    it("are consistent", () => {
        const config: GrapherInterface = {
            $schema: SCHEMA_URL,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
            title: "Chart",
            subtitle: "Chart subtitle",
        }
        const reference: GrapherInterface = {
            $schema: SCHEMA_URL,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
            title: "Reference chart",
        }
        const diffedAndMerged = mergeGrapherConfigs(
            reference,
            diffGrapherConfigs(config, reference)
        )
        const onlyMerged = mergeGrapherConfigs(reference, config)
        expect(diffedAndMerged).toEqual(onlyMerged)
    })
})
