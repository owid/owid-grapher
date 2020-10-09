import { BodyDiv } from "grapher/bodyDiv/BodyDiv"
import { sortBy } from "grapher/utils/Util"
import { observer } from "mobx-react"
import React from "react"

declare type keyboardCombo = string

export interface Command {
    combo: keyboardCombo
    fn: () => any
    title?: string
    category?: string
}

@observer
export class CommandPalette extends React.Component<{
    commands: Command[]
    display: "none" | "block"
}> {
    render() {
        const style: any = {
            display: this.props.display,
        }
        let lastCat = ""
        const commands = this.props.commands.filter(
            (command) => command.title && command.category
        )
        const sortedCommands = sortBy(commands, "category").map(
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
                            <span className="commandCombo">
                                {command.combo}
                            </span>
                            <a onClick={() => command.fn()}>{command.title}</a>
                        </div>
                    </div>
                )
            }
        )

        return (
            <BodyDiv>
                <div className="CommandPalette" style={style}>
                    <div className="paletteTitle">Keyboard Shortcuts</div>
                    {sortedCommands}
                </div>
            </BodyDiv>
        )
    }
}
