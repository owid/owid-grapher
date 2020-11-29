#! /usr/bin/env jest

import React from "react"
import { ExplorerCreatePage } from "./ExplorerCreatePage"

import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

describe(ExplorerCreatePage, () => {
    const element = mount(
        <ExplorerCreatePage
            slug={"sample"}
            gitCmsBranchName={"dev"}
            doNotFetch={true}
        />
    )
    it("renders", () => {
        expect(element.find(`.loading-indicator`).length).toEqual(1)
    })
})
