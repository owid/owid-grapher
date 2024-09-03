#! /usr/bin/env jest

import {
    DimensionProperty,
    GrapherInterface,
    GrapherTabOption,
    MapProjectionName,
} from "@ourworldindata/types"
import {
    mergeGrapherConfigs,
    diffGrapherConfigs,
} from "./grapherConfigUtils.js"

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
        const parentConfig = { title: "Title" }
        const childConfig = { subtitle: "Subtitle" }
        mergeGrapherConfigs(parentConfig, childConfig)
        expect(parentConfig).toEqual({ title: "Title" })
        expect(childConfig).toEqual({ subtitle: "Subtitle" })
    })

    it("merges two objects", () => {
        expect(
            mergeGrapherConfigs(
                { title: "Parent title" },
                { subtitle: "Child subtitle" }
            )
        ).toEqual({
            title: "Parent title",
            subtitle: "Child subtitle",
        })
        expect(
            mergeGrapherConfigs(
                { title: "Parent title" },
                { title: "Child title" }
            )
        ).toEqual({ title: "Child title" })
        expect(
            mergeGrapherConfigs(
                { title: "Parent title", subtitle: "Parent subtitle" },
                { title: "Child title", hideRelativeToggle: true }
            )
        ).toEqual({
            title: "Child title",
            subtitle: "Parent subtitle",
            hideRelativeToggle: true,
        })
    })

    it("merges three objects", () => {
        expect(
            mergeGrapherConfigs(
                { title: "Parent title" },
                { subtitle: "Child subtitle" },
                { note: "Grandchild note" }
            )
        ).toEqual({
            title: "Parent title",
            subtitle: "Child subtitle",
            note: "Grandchild note",
        })
        expect(
            mergeGrapherConfigs(
                {
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                    sourceDesc: "Parent sources",
                },
                { title: "Child title", subtitle: "Child subtitle" },
                { title: "Grandchild title", note: "Grandchild note" }
            )
        ).toEqual({
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
                    map: {
                        projection: MapProjectionName.World,
                        time: 2000,
                    },
                },
                {
                    map: {
                        projection: MapProjectionName.Africa,
                        hideTimeline: true,
                    },
                }
            )
        ).toEqual({
            map: {
                projection: MapProjectionName.Africa,
                time: 2000,
                hideTimeline: true,
            },
        })
    })

    it("overwrites arrays", () => {
        expect(
            mergeGrapherConfigs(
                { selectedEntityNames: ["France", "Italy"] },
                { selectedEntityNames: ["Italy", "Spain"] }
            )
        ).toEqual({
            selectedEntityNames: ["Italy", "Spain"],
        })
        expect(
            mergeGrapherConfigs(
                { colorScale: { customNumericValues: [1, 2] } },
                { colorScale: { customNumericValues: [3, 4] } }
            )
        ).toEqual({
            colorScale: { customNumericValues: [3, 4] },
        })
    })

    it("doesn't merge configs of different schema versions", () => {
        expect(() =>
            mergeGrapherConfigs(
                { $schema: "1", title: "Title A" },
                { $schema: "2", title: "Title B" }
            )
        ).toThrowError()
    })

    it("excludes id, slug, version and isPublished from inheritance", () => {
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "004",
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                { title: "Title B" }
            )
        ).toEqual({ title: "Title B" })
        expect(
            mergeGrapherConfigs(
                {
                    $schema: "004",
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                { slug: "child-slug", version: 1, title: "Title B" }
            )
        ).toEqual({
            slug: "child-slug",
            version: 1,
            title: "Title B",
        })
    })

    it("ignores empty objects", () => {
        expect(
            mergeGrapherConfigs(
                {
                    title: "Parent title",
                    subtitle: "Parent subtitle",
                },
                {
                    $schema: "004",
                    id: 1,
                    slug: "parent-slug",
                    version: 1,
                    title: "Title A",
                },
                {}
            )
        ).toEqual({
            $schema: "004",
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
                { title: "Parent title", subtitle: "Parent subtitle" },
                { subtitle: "" }
            )
        ).toEqual({ title: "Parent title", subtitle: "" })
    })

    it("is associative", () => {
        const configA: GrapherInterface = {
            title: "Title A",
            subtitle: "Subtitle A",
        }
        const configB: GrapherInterface = { title: "Title B", note: "Note B" }
        const configC: GrapherInterface = {
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
                { tab: GrapherTabOption.map },
                { tab: GrapherTabOption.map }
            )
        ).toEqual({})
        expect(
            diffGrapherConfigs(
                { tab: GrapherTabOption.chart, title: "Chart" },
                { tab: GrapherTabOption.chart, title: "Reference chart" }
            )
        ).toEqual({ title: "Chart" })
    })

    it("diffs nested configs correctly", () => {
        expect(
            diffGrapherConfigs(
                {
                    title: "Chart",
                    tab: GrapherTabOption.chart,
                    map: {
                        projection: MapProjectionName.World,
                        hideTimeline: true,
                    },
                },
                {
                    title: "Reference chart",
                    tab: GrapherTabOption.chart,
                    map: {
                        projection: MapProjectionName.World,
                        hideTimeline: false,
                    },
                }
            )
        ).toEqual({ title: "Chart", map: { hideTimeline: true } })
        expect(
            diffGrapherConfigs(
                {
                    tab: GrapherTabOption.chart,
                    map: {
                        projection: MapProjectionName.World,
                        hideTimeline: true,
                    },
                },
                {
                    tab: GrapherTabOption.chart,
                    map: {
                        projection: MapProjectionName.World,
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
                    tab: GrapherTabOption.chart,
                    title: "Chart",
                    subtitle: undefined,
                },
                { tab: GrapherTabOption.chart, title: "Reference chart" }
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
            tab: GrapherTabOption.chart,
            title: "Chart",
            subtitle: undefined,
        }
        const reference: GrapherInterface = {
            tab: GrapherTabOption.chart,
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
            tab: GrapherTabOption.chart,
            title: "Chart",
            subtitle: "Chart subtitle",
        }
        const reference: GrapherInterface = {
            tab: GrapherTabOption.chart,
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
