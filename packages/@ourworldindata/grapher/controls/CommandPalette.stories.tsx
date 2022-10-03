import React from "react"
import { CommandPalette, Command } from "../controls/CommandPalette.js"

export default {
    title: "CommandPalette",
    component: CommandPalette,
}

export const WithCommands = (): JSX.Element => {
    const demoCommands: Command[] = [
        {
            combo: "ctrl+o",
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            fn: (): void => {},
            title: "Open",
            category: "File",
        },
        {
            combo: "ctrl+s",
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            fn: (): void => {},
            title: "Save",
            category: "File",
        },
        {
            combo: "ctrl+c",
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            fn: (): void => {},
            title: "Copy",
            category: "Edit",
        },
    ]
    return <CommandPalette commands={demoCommands} display="block" />
}
