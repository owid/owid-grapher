import { ColorScheme, ColorSchemes } from "charts/ColorSchemes"
import { lastOfNonEmptyArray } from "charts/Util"
import { action } from "mobx"
import * as React from "react"

import { TextField } from "./Forms"

export interface ColorpickerProps {
    color?: string
    onColor: (color: string | undefined) => void
    onClose: () => void
}

export class Colorpicker extends React.Component<ColorpickerProps> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    componentDidMount() {
        const textField = this.base.current!.querySelector(
            "input"
        ) as HTMLInputElement
        textField.focus()

        setTimeout(
            () => window.addEventListener("click", this.onClickOutside),
            10
        )
    }

    componentWillUnmount() {
        window.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onClickOutside() {
        this.props.onClose()
    }

    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    render() {
        const scheme = ColorSchemes["owid-distinct"] as ColorScheme
        const availableColors: string[] = lastOfNonEmptyArray(scheme.colorSets)

        return (
            <div
                ref={this.base}
                className="Colorpicker"
                tabIndex={0}
                onClick={e => e.stopPropagation()}
            >
                <ul>
                    {availableColors.map((color, i) => (
                        <li
                            key={i}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                                this.props.onColor(color)
                                this.props.onClose()
                            }}
                        />
                    ))}
                </ul>
                <TextField
                    placeholder="#xxxxxx"
                    value={this.props.color}
                    onValue={this.onColor}
                    onEnter={this.props.onClose}
                    onEscape={this.props.onClose}
                />
            </div>
        )
    }
}
