import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import classNames from "classnames"

export interface ControlOption {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    available: boolean
}

@observer
export class ExplorerControl extends React.Component<{
    name: string
    isCheckbox?: boolean
    options: ControlOption[]
    comment?: string
    hideLabel?: boolean
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onChange(
            ev.currentTarget.checked
        )
    }

    render() {
        const { name, comment, hideLabel } = this.props
        return (
            <div
                className={classNames(
                    "CovidDataExplorerControl",
                    this.props.name
                )}
            >
                <div
                    className={
                        "ControlHeader" +
                        (hideLabel === true ? " HiddenControlHeader" : "")
                    }
                >
                    {name}
                </div>
                {this.props.options.map((option, index) => (
                    <div key={index}>
                        <label
                            className={[
                                option.checked ? "SelectedOption" : "Option",
                                option.available
                                    ? "AvailableOption"
                                    : "UnavailableOption"
                            ].join(" ")}
                            data-track-note={`covid-click-${name}`}
                        >
                            <input
                                onChange={
                                    option.available ? this.onChange : undefined
                                }
                                type={
                                    this.props.isCheckbox ? "checkbox" : "radio"
                                }
                                disabled={!option.available}
                                name={name}
                                checked={option.available && option.checked}
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
