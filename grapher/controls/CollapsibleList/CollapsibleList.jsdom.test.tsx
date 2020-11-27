#! /usr/bin/env jest

import * as React from "react"
import { shallow } from "enzyme"
import { CollapsibleList, numItemsVisible } from "./CollapsibleList"
import { collapsibleListSampleItems } from "./CollapsibleList.sampleInput"

describe("when you render a collapsible list", () => {
    test("something renders", () => {
        const view = shallow(
            <CollapsibleList>{collapsibleListSampleItems}</CollapsibleList>
        )
        expect(view.find(".list-item")).not.toHaveLength(0)
    })
})

test("testing numItemsVisible utility function", () => {
    expect(numItemsVisible([], 10, 1)).toEqual(0)
    expect(numItemsVisible([1], 10, 1)).toEqual(1)

    expect(numItemsVisible([2], 10, 9)).toEqual(0)
    expect(numItemsVisible([1], 10, 9)).toEqual(1)

    expect(numItemsVisible([5, 5, 5], 15, 0)).toEqual(3)
    expect(numItemsVisible([5, 5, 5], 15, 1)).toEqual(2)

    expect(numItemsVisible([5, 5, 5], 0, 1)).toEqual(0)
})
