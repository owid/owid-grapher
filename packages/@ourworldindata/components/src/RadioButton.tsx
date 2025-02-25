import * as React from "react"

export class RadioButton extends React.Component<{
    checked: boolean
    onChange: React.ChangeEventHandler<HTMLInputElement>
    label: React.ReactNode
    group?: string
    disabled?: boolean
    id?: string
    "data-test"?: string
}> {
    render(): React.ReactElement {
        const { checked, onChange, label, group, disabled, id } = this.props
        const testHook = this.props["data-test"]

        return (
            <div className="radio">
                <label>
                    <input
                        type="radio"
                        id={id}
                        data-test={testHook}
                        disabled={disabled}
                        name={group}
                        checked={checked}
                        onChange={onChange}
                    />
                    <div className="outer">
                        {checked && <div className="inner" />}
                    </div>
                    <div className="label">{label}</div>
                </label>
            </div>
        )
    }
}
