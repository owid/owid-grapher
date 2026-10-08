import { describe, expect, it } from "vitest"

import { getNodeSideFromLinks } from "./Sankey.js"

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
