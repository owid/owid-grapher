#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import React from "react"
import { ExplorerControlType } from "./ExplorerConstants"
import { ExplorerControlPanel } from "./ExplorerControls"

describe(ExplorerControlPanel, () => {
    const options = [
        {
            label: "Paper",
            available: true,
            value: "paper",
        },
        {
            label: "Plastic",
            available: true,
            value: "plastic",
        },
    ]

    const element = mount(
        <ExplorerControlPanel
            title="Some decision"
            name="decision"
            explorerSlug="explorer_slug"
            type={ExplorerControlType.Radio}
            options={options}
        />
    )

    it("renders options", () => {
        expect(element.find(`.AvailableOption`).length).toEqual(2)
    })
})
