import * as React from "react"
import "site/client/owid.scss"
import "charts/client/chart.scss"
import {
    CommandPalette,
    Command
} from "charts/covidDataExplorer/CommandPalette"

export default {
    title: "CommandPalette",
    component: CommandPalette
}

export const Default = () => {
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
}
