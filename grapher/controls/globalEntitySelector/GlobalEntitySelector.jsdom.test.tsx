#! /usr/bin/env jest

import * as React from "react"

import { configure, shallow } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import { GlobalEntitySelector } from "./GlobalEntitySelector"
import { SelectionArray } from "../../selection/SelectionArray"
configure({ adapter: new Adapter() })

describe("when you render a GlobalEntitySelector", () => {
    test("something renders", () => {
        const view = shallow(
            <GlobalEntitySelector selection={new SelectionArray()} />
        )
        expect(view.find(".global-entity-control")).not.toHaveLength(0)
    })
})
