import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"

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
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onChange(
            ev.currentTarget.checked
        )
    }

    render() {
        return (
            <div className="CovidChartBuilderControl">
                <div className="ControlHeader">{this.props.name}</div>
                {this.props.options.map((option, index) => (
                    <div key={index}>
                        <label
                            className={
                                option.checked ? "SelectedOption" : "Option"
                            }
                        >
                            <input
                                onChange={this.onChange}
                                type={
                                    this.props.isCheckbox ? "checkbox" : "radio"
                                }
                                name={this.props.name}
                                checked={option.checked}
                                value={index}
                            />{" "}
                            {option.label}
                        </label>
                    </div>
                ))}
            </div>
        )
    }
}
