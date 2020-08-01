import * as React from "react"

import { storiesOf } from "@storybook/react"

import "site/client/owid.scss"
import "charts/client/chart.scss"
import { CommandPalette, Command } from "charts/CommandPalette"

storiesOf("CommandPalette", module).add("testCommands", () => {
    const demoCommands: Command[] = [
        {
            combo: "ctrl+o",
            fn: () => {},
            title: "Open",
            category: "File"
        },
        {
            combo: "ctrl+s",
            fn: () => {},
            title: "Save",
            category: "File"
        },
        {
            combo: "ctrl+c",
            fn: () => {},
            title: "Copy",
            category: "Edit"
        }
    ]
    return <CommandPalette commands={demoCommands} display="block" />
})
