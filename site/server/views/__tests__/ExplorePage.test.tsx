import { shallow } from "enzyme"
import * as React from "react"

import { ExplorePage } from "../ExplorePage"
import { SiteFooter } from "../SiteFooter"
import { SiteHeader } from "../SiteHeader"

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
