#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow } from "enzyme"
import { collapsibleListSampleItems } from "./CollapsibleList.stories"
import { CollapsibleList } from "./CollapsibleList"

// configure({ adapter: new Adapter() })
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
