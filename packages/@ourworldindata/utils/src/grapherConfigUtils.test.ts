#! /usr/bin/env jest

import { GrapherTabOption, MapProjectionName } from "@ourworldindata/types"
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

    it("doesn't mutate input objects", () => {
        const parentConfig = { title: "Title" }
        const childConfig = {
            title: "Title overwrite",
            subtitle: "Subtitle",
        }
        mergeGrapherConfigs(parentConfig, childConfig)
        expect(parentConfig).toEqual({ title: "Title" })
        expect(childConfig).toEqual({
            title: "Title overwrite",
            subtitle: "Subtitle",
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

    it("doesn't overwrite id, slug, version and isPublished", () => {
        expect(
            mergeGrapherConfigs(
                { id: 1, slug: "parent-slug", version: 1, title: "Title A" },
                { title: "Title B" }
            )
        ).toEqual({ title: "Title B" })
        expect(
            mergeGrapherConfigs(
                { id: 1, slug: "parent-slug", version: 1, title: "Title A" },
                { slug: "child-slug", title: "Title B" }
            )
        ).toEqual({ slug: "child-slug", title: "Title B" })
    })
})

describe(diffGrapherConfigs, () => {
    it("drops redundant entries", () => {
        expect(
            diffGrapherConfigs(
                { tab: GrapherTabOption.chart, title: "Child chart" },
                { tab: GrapherTabOption.chart, title: "Parent chart" }
            )
        ).toEqual({ title: "Child chart" })
    })

    it("diffs nested configs correctly", () => {
        expect(
            diffGrapherConfigs(
                {
                    title: "Child chart",
                    tab: GrapherTabOption.chart,
                    map: {
                        projection: MapProjectionName.World,
                        hideTimeline: true,
                    },
                },
                {
                    title: "Parent chart",
                    tab: GrapherTabOption.chart,
                    map: {
                        projection: MapProjectionName.World,
                        hideTimeline: false,
                    },
                }
            )
        ).toEqual({ title: "Child chart", map: { hideTimeline: true } })
    })

    it("strips undefined values from the config", () => {
        expect(
            diffGrapherConfigs(
                {
                    tab: GrapherTabOption.chart,
                    title: "Child chart",
                    subtitle: undefined,
                },
                { tab: GrapherTabOption.chart, title: "Parent chart" }
            )
        ).toEqual({ title: "Child chart" })
    })
})
