import * as React from "react"
import { CommandPalette, Command } from "../controls/CommandPalette"

export default {
    title: "CommandPalette",
    component: CommandPalette,
}

export const WithCommands = (): React.ReactElement => {
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
