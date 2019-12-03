import * as React from "react"
import { shallow } from "enzyme"

import { ExplorePage } from "../ExplorePage"

describe(ExplorePage, () => {
    it("renders a blockquote", () => {
        expect(shallow(<ExplorePage />).find("blockquote").length).toBe(1)
    })
})
