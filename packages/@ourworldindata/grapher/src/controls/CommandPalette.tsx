import * as _ from "lodash-es"
import * as React from "react"

export interface Command {
    combo: string
    fn: () => void
    title?: string
    category?: string
}

interface CommandPaletteProps {
    commands: Command[]
}

export function CommandPalette({
    commands,
}: CommandPaletteProps): React.ReactElement {
    let lastCat = ""
    const filteredCommands = commands.filter(
        (command) => command.title && command.category
    )
    const sortedCommands = _.sortBy(filteredCommands, "category").map(
        (command, index) => {
            let cat = undefined
            if (command.category !== lastCat) {
                lastCat = command.category!
                cat = <div className="commandCategory">{lastCat}</div>
            }
            return (
                <div key={`command${index}`}>
                    {cat}
                    <div className="commandOption">
                        <span className="commandCombo">{command.combo}</span>
                        <a onClick={command.fn}>{command.title}</a>
                    </div>
                </div>
            )
        }
    )

    return (
        <div className="CommandPalette">
            <div className="paletteTitle">Keyboard Shortcuts</div>
            {sortedCommands}
        </div>
    )
}
