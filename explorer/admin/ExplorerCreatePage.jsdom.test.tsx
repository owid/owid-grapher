#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import React from "react"
import { ExplorerCreatePage } from "./ExplorerCreatePage"

describe(ExplorerCreatePage, () => {
    const element = mount(
        <ExplorerCreatePage slug={"sample"} gitCmsBranchName={"dev"} />
    )
    it("renders", () => {
        expect(element.find(`.loading-indicator`).length).toEqual(1)
    })
})
