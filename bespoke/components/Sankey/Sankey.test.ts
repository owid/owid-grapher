import { describe, expect, it } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { getNodeSideFromLinks, measureMaxLabelWidthForNode } from "./Sankey.js"

it("reserves the widest annotation line at its own font size", () => {
    const fontSettings = { fontSize: 12, fontWeight: 400, lineHeight: 1 }
    const annotationFontSize = 9
    expect(
        measureMaxLabelWidthForNode(
            {
                id: "domestic",
                label: "",
                annotation: "produced and consumed\ndomestically",
                annotationFontSize,
            },
            fontSettings
        )
    ).toBeCloseTo(
        Bounds.forText("produced and consumed", {
            ...fontSettings,
            fontSize: annotationFontSize,
        }).width
    )
})

describe(getNodeSideFromLinks, () => {
    it("puts a node that is only a link source in the left column", () => {
        expect(
            getNodeSideFromLinks({ isLinkSource: true, isLinkTarget: false })
        ).toEqual("left")
    })

    it("puts a node that is only a link target in the right column", () => {
        expect(
            getNodeSideFromLinks({ isLinkSource: false, isLinkTarget: true })
        ).toEqual("right")
    })

    it("puts a node that is both source and target in a middle column", () => {
        expect(
            getNodeSideFromLinks({ isLinkSource: true, isLinkTarget: true })
        ).toEqual("middle")
    })

    it("puts a node without any links in no column", () => {
        expect(
            getNodeSideFromLinks({ isLinkSource: false, isLinkTarget: false })
        ).toBeUndefined()
    })
})
