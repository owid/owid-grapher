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
    title: string
    name: string
    options: ControlOption[]
    isCheckbox?: boolean
    comment?: string
    hideTitle?: boolean
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onChange(
            ev.currentTarget.checked
        )
    }

    render() {
        const {
            title,
            name,
            comment,
            options,
            isCheckbox,
            hideTitle
        } = this.props
        return (
            <div className={classNames("CovidDataExplorerControl", name)}>
                <div
                    className={
                        "ControlHeader" +
                        (hideTitle === true ? " HiddenControlHeader" : "")
                    }
                >
                    {title}
                </div>
                {options.map((option, index) => (
                    <div key={index} className="ControlOption">
                        <label
                            className={[
                                option.checked ? "SelectedOption" : "Option",
                                option.available
                                    ? "AvailableOption"
                                    : "UnavailableOption"
                            ].join(" ")}
                            data-track-note={`covid-click-${title.toLowerCase()}`}
                        >
                            <input
                                onChange={
                                    option.available ? this.onChange : undefined
                                }
                                type={isCheckbox ? "checkbox" : "radio"}
                                disabled={!option.available}
                                name={name}
                                checked={option.available && option.checked}
                                value={index}
                            />{" "}
                            {option.label}
                            {comment && (
                                <div
                                    className={[
                                        "comment",
                                        option.available
                                            ? "AvailableOption"
                                            : "UnavailableOption"
                                    ].join(" ")}
                                >
                                    {comment}
                                </div>
                            )}
                        </label>
                    </div>
                ))}
            </div>
        )
    }
}
