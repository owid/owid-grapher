#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow } from "enzyme"
import { CollapsibleList } from "./CollapsibleList"
import { collapsibleListSampleItems } from "./CollapsibleList.sampleInput"

describe(CollapsibleList, () => {
    describe("when you render a collapsible list", () => {
        test("something renders", () => {
            const view = shallow(
                <CollapsibleList>{collapsibleListSampleItems}</CollapsibleList>
            )
            expect(view.find(".list-item.visible")).not.toHaveLength(0)
        })
    })
})
