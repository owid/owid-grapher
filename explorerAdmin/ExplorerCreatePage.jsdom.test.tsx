#! /usr/bin/env jest

import { mount } from "enzyme"
import React from "react"
import { ExplorerCreatePage } from "./ExplorerCreatePage"

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
