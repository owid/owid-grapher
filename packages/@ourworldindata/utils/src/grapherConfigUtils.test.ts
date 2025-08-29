import { expect, it, describe, vi } from "vitest"

import * as _ from "lodash-es"
import {
    DimensionProperty,
    GrapherInterface,
    MapRegionName,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import { diffGrapherConfigs, mergeGrapherConfigs } from "./GrapherConfigUtils"

describe(mergeGrapherConfigs, () => {
    it("merges empty configs", () => {
        expect(mergeGrapherConfigs({}, {})).toEqual({})
        expect(
            mergeGrapherConfigs({ $schema: "1", title: "Parent title" }, {})
        ).toEqual({
            $schema: "1",
            title: "Parent title",
        })
        expect(
            mergeGrapherConfigs({}, { $schema: "1", title: "Child title" })
        ).toEqual({
            $schema: "1",
            title: "Child title",
        })
    })

    it("doesn't mutate input objects", () => {
        const parentConfig = { $schema: "1", title: "Title" }
        const childConfig = { $schema: "1", subtitle: "Subtitle" }
        mergeGrapherConfigs(parentConfig, childConfig)
        expect(parentConfig).toEqual({ $schema: "1", title: "Title" })
        expect(childConfig).toEqual({ $schema: "1", subtitle: "Subtitle" })
    })

    it("merges two objects", () => {
        expect(
            mergeGrapherConfigs(
                { $schema: "1", title: "Parent title" },
                { $schema: "1", subtitle: "Child subtitle" }
            )
        ).toEqual({
            $schema: "1",
            title: "Parent title",
            subtitle: "Child subtitle",
        })
        expect(
            mergeGrapherConfigs(
                { $schema: "1", title: "Parent title" },
                { $schema: "1", title: "Child title" }
            )
        ).toEqual({ $schema: "1", title: "Child title" })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "1",
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                {
                    $schema: "1",
                    title: "Child title",
                    hideRelativeToggle: true,
                }
            )
        ).toEqual({
            $schema: "1",
            title: "Child title",
            subtitle: "Parent subtitle",
            hideRelativeToggle: true,
        })
    })

    it("merges three objects", () => {
        expect(
            mergeGrapherConfigs(
                { $schema: "1", title: "Parent title" },
                { $schema: "1", subtitle: "Child subtitle" },
                { $schema: "1", note: "Grandchild note" }
            )
        ).toEqual({
            $schema: "1",
            title: "Parent title",
            subtitle: "Child subtitle",
            note: "Grandchild note",
        })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "1",
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                    sourceDesc: "Parent sources",
                },
                {
                    $schema: "1",
                    title: "Child title",
                    subtitle: "Child subtitle",
                },
                {
                    $schema: "1",
                    title: "Grandchild title",
                    note: "Grandchild note",
                }
            )
        ).toEqual({
            $schema: "1",
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
                    $schema: "1",
                    map: {
                        region: MapRegionName.World,
                        time: 2000,
                    },
                },
                {
                    $schema: "1",
                    map: {
                        region: MapRegionName.Africa,
                        hideTimeline: true,
                    },
                }
            )
        ).toEqual({
            $schema: "1",
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
                { $schema: "1", selectedEntityNames: ["France", "Italy"] },
                { $schema: "1", selectedEntityNames: ["Italy", "Spain"] }
            )
        ).toEqual({
            $schema: "1",
            selectedEntityNames: ["Italy", "Spain"],
        })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "1",
                    colorScale: { customNumericValues: [1, 2] },
                },
                {
                    $schema: "1",
                    colorScale: { customNumericValues: [3, 4] },
                }
            )
        ).toEqual({
            $schema: "1",
            colorScale: { customNumericValues: [3, 4] },
        })
    })

    it("warns when merging configs of different schema versions", () => {
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(_.noop)

        expect(
            mergeGrapherConfigs(
                { $schema: "1", title: "Title A" },
                { $schema: "2", title: "Title B" }
            )
        ).toEqual({
            $schema: "2",
            title: "Title B",
        })

        expect(consoleWarnSpy).toHaveBeenCalled()
        consoleWarnSpy.mockRestore()
    })

    it("excludes id, slug, version and isPublished from inheritance", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "1",
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                { $schema: "1", title: "Title B" }
            )
        ).toEqual({ $schema: "1", title: "Title B" })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "1",
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                {
                    $schema: "1",
                    slug: "child-slug",
                    version: 1,
                    title: "Title B",
                }
            )
        ).toEqual({
            $schema: "1",
            slug: "child-slug",
            version: 1,
            title: "Title B",
        })
    })

    it("ignores empty objects", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "1",
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                {
                    $schema: "1",
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                {}
            )
        ).toEqual({
            $schema: "1",
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
                    $schema: "1",
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                { $schema: "1", subtitle: "" }
            )
        ).toEqual({ $schema: "1", title: "Parent title", subtitle: "" })
    })

    it("is associative", () => {
        const configA: GrapherInterface = {
            $schema: "1",
            title: "Title A",
            subtitle: "Subtitle A",
        }
        const configB: GrapherInterface = {
            $schema: "1",
            title: "Title B",
            note: "Note B",
        }
        const configC: GrapherInterface = {
            $schema: "1",
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

    it("doesn't diff $schema, id, version, slug, isPublished or dimensions", () => {
        expect(
            diffGrapherConfigs(
                {
                    title: "Chart",
                    $schema:
                        "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
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
                    $schema:
                        "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
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
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
            id: 20,
            version: 1,
            slug: "slug",
            isPublished: false,
            dimensions: [{ property: DimensionProperty.y, variableId: 123456 }],
        })
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
            $schema: "1",
            tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
            title: "Chart",
            subtitle: "Chart subtitle",
        }
        const reference: GrapherInterface = {
            $schema: "1",
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
