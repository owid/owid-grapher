#! /usr/bin/env jest

import * as React from "react"
import { shallow } from "enzyme"

import { ExplorePage } from "../ExplorePage"
import { SiteHeader } from "../SiteHeader"
import { SiteFooter } from "../SiteFooter"

describe(ExplorePage, () => {
    it("renders a site header", () => {
        expect(shallow(<ExplorePage />).find(SiteHeader).length).toBe(1)
    })

    it("renders an 'explore' element", () => {
        expect(shallow(<ExplorePage />).find("#explore").length).toBe(1)
    })

    it("renders a site footer", () => {
        expect(shallow(<ExplorePage />).find(SiteFooter).length).toBe(1)
    })
})
