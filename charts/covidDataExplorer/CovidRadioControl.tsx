import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import classNames from "classnames"

export interface RadioOption {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
}

@observer
export class CovidRadioControl extends React.Component<{
    name: string
    isCheckbox?: boolean
    options: RadioOption[]
    comment?: string
    label?: string
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onChange(
            ev.currentTarget.checked
        )
    }

    render() {
        const { name, comment, label } = this.props
        return (
            <div
                className={classNames(
                    "CovidDataExplorerControl",
                    this.props.name
                )}
            >
                <div className="ControlHeader">{label || name}</div>
                {this.props.options.map((option, index) => (
                    <div key={index}>
                        <label
                            className={
                                option.checked ? "SelectedOption" : "Option"
                            }
                            data-track-note={`covid-click-${name}`}
                        >
                            <input
                                onChange={this.onChange}
                                type={
                                    this.props.isCheckbox ? "checkbox" : "radio"
                                }
                                name={name}
                                checked={option.checked}
                                value={index}
                            />{" "}
                            {option.label}
                            {comment && (
                                <div className="comment">{comment}</div>
                            )}
                        </label>
                    </div>
                ))}
            </div>
        )
    }
}
