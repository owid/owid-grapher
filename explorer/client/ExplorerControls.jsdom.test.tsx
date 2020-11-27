#! /usr/bin/env jest

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
            choice={{
                title: "Some decision",
                value: "",
                options,
                type: ExplorerControlType.Radio,
            }}
            explorerSlug="explorer_slug"
        />
    )

    it("renders options", () => {
        expect(element.find(`.AvailableOption`).length).toEqual(2)
    })
})
