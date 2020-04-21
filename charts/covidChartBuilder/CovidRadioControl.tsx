import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"

export interface RadioOption {
    label: string
    checked: boolean
    onSelect: () => void
}

@observer
export class CovidRadioControl extends React.Component<{
    name: string
    options: RadioOption[]
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onSelect()
    }

    render() {
        return (
            <div className="CovidChartBuilderRadio">
                {this.props.options.map((option, index) => (
                    <div key={index}>
                        <label>
                            <input
                                onChange={this.onChange}
                                type="radio"
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
