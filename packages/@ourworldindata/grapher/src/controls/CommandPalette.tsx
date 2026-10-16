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
    const filteredCommands = commands.filter(
        (command) => command.title && command.category
    )
    const sortedCommands = _.sortBy(filteredCommands, "category").map(
        (command, index, sorted) => {
            // Show the category heading above the first command of each category
            const cat =
                command.category !== sorted[index - 1]?.category ? (
                    <div className="commandCategory">{command.category}</div>
                ) : undefined
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
