import { describe, expect, it } from "vitest"
import { type GdocComponentPreviewItem } from "@ourworldindata/types"
import { type ComponentPreviewBlock } from "./componentPreviewBlocks.js"
import {
    type ComponentPreviewSource,
    componentPreviewSpecKey,
} from "./componentPreviewSources.js"
import { planComponentPreviewChanges } from "./componentPreviewPlan.js"

const PREFIX = "https://ourworldindata.org/grapher"
const CURRENT_URL = `${PREFIX}/by-uuid/abc.png?v=2`
const CHART_ASPECT_RATIO = 850 / 600

function makeBlock(
    image?: Partial<NonNullable<ComponentPreviewBlock["image"]>>,
    imageBelow?: ComponentPreviewBlock["imageBelow"]
): ComponentPreviewBlock {
    return {
        tabId: "t.0",
        tabTitle: "Article",
        componentStartIndex: 100,
        spec: {
            type: "chart",
            kind: "chartUrl",
            target: "https://ourworldindata.org/grapher/life-expectancy",
        },
        image: image ? { objectId: "kix.1", startIndex: 90, ...image } : image,
        imageBelow,
    }
}

/** What the plan does to a single block, given the chart's current source */
function plan(
    block: ComponentPreviewBlock,
    source: ComponentPreviewSource = {
        status: "resolved",
        imageUrl: CURRENT_URL,
        aspectRatio: CHART_ASPECT_RATIO,
    }
): Pick<GdocComponentPreviewItem, "status" | "reason"> & { change: string } {
    const { items, planned } = planComponentPreviewChanges(
        [block],
        new Map([[componentPreviewSpecKey(block.spec), source]]),
        [PREFIX]
    )
    const { status, reason } = items.get(block)!
    const change = (["replacements", "insertions", "reinsertions"] as const)
        .filter((kind) => planned[kind].length > 0)
        .join()
    return { status, reason, change }
}

// A frame with the shape of a chart render
const CHART_FRAME = { width: 468, height: 468 / CHART_ASPECT_RATIO }

describe(planComponentPreviewChanges, () => {
    it("leaves a current image in a frame of the right shape alone", () => {
        expect(
            plan(makeBlock({ sourceUri: CURRENT_URL, size: CHART_FRAME }))
        ).toEqual({ status: "upToDate", reason: undefined, change: "" })
    })

    it("replaces an outdated preview in place", () => {
        expect(
            plan(
                makeBlock({
                    sourceUri: `${PREFIX}/by-uuid/abc.png?v=1`,
                    size: CHART_FRAME,
                })
            )
        ).toEqual({
            status: "updated",
            reason: "outdated",
            change: "replacements",
        })
    })

    it("tells images pasted in by hand apart from outdated previews", () => {
        expect(plan(makeBlock({ size: CHART_FRAME })).reason).toBe(
            "pastedByHand"
        )
        expect(
            plan(
                makeBlock({
                    sourceUri: "https://example.com/chart.png",
                    size: CHART_FRAME,
                })
            ).reason
        ).toBe("pastedByHand")
    })

    // A chart's frame can have the wrong shape, e.g. when a cropped
    // screenshot was pasted in. Replacing in place would keep cropping.
    it("reinserts a chart whose frame has a different shape", () => {
        expect(plan(makeBlock({ size: { width: 468, height: 200 } }))).toEqual({
            status: "updated",
            reason: "pastedByHand",
            change: "reinsertions",
        })
    })

    it("reinserts a current image whose frame has the wrong shape", () => {
        expect(
            plan(
                makeBlock({
                    sourceUri: CURRENT_URL,
                    size: { width: 468, height: 468 },
                })
            )
        ).toEqual({
            status: "updated",
            reason: "wrongShape",
            change: "reinsertions",
        })
    })

    it("tolerates small differences in shape, e.g. from rounding", () => {
        expect(
            plan(
                makeBlock({
                    sourceUri: CURRENT_URL,
                    size: { width: 468, height: CHART_FRAME.height + 3 },
                })
            ).status
        ).toBe("upToDate")
    })

    it("doesn't check the shape when the image's is unknown", () => {
        expect(
            plan(
                makeBlock({
                    sourceUri: CURRENT_URL,
                    size: { width: 468, height: 468 },
                }),
                { status: "resolved", imageUrl: CURRENT_URL }
            ).status
        ).toBe("upToDate")
    })

    it("adds an image to a component without one", () => {
        expect(plan(makeBlock())).toEqual({
            status: "inserted",
            reason: undefined,
            change: "insertions",
        })
    })

    it("only reports an image below the component", () => {
        expect(
            plan(makeBlock(undefined, { objectId: "kix.2", startIndex: 120 }))
        ).toEqual({ status: "imageBelow", reason: undefined, change: "" })
    })

    it("leaves components it can't resolve alone", () => {
        expect(
            plan(makeBlock(), {
                status: "unresolved",
                message: "Chart not found",
            })
        ).toEqual({ status: "unresolved", reason: undefined, change: "" })
    })
})
