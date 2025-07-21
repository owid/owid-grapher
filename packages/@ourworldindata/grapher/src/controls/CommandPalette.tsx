import * as _ from "lodash-es"
import { BodyDiv } from "@ourworldindata/components"
import { observer } from "mobx-react"
import * as React from "react"

declare type keyboardCombo = string

export interface Command {
    combo: keyboardCombo
    fn: () => void
    title?: string
    category?: string
}

const CommandPaletteClassName = "CommandPalette"

interface CommandPaletteProps {
    commands: Command[]
    display: "none" | "block"
}

@observer
export class CommandPalette extends React.Component<CommandPaletteProps> {
    static togglePalette(): void {
        const element = document.getElementsByClassName(
            CommandPaletteClassName
        )[0] as HTMLElement
        if (element)
            element.style.display =
                element.style.display === "none" ? "block" : "none"
    }

    render(): React.ReactElement {
        const style: any = {
            display: this.props.display,
        }
        let lastCat = ""
        const commands = this.props.commands.filter(
            (command) => command.title && command.category
        )
        const sortedCommands = _.sortBy(commands, "category").map(
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
                            <a onClick={(): void => command.fn()}>
                                {command.title}
                            </a>
                        </div>
                    </div>
                )
            }
        )

        return (
            <BodyDiv>
                <div className={CommandPaletteClassName} style={style}>
                    <div className="paletteTitle">Keyboard Shortcuts</div>
                    {sortedCommands}
                </div>
            </BodyDiv>
        )
    }
}
