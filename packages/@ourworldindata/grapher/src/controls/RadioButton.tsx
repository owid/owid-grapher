import React from "react"

export class RadioButton extends React.Component<{
    checked: boolean
    onChange: React.ChangeEventHandler<HTMLInputElement>
    label: React.ReactNode
    group?: string
}> {
    render(): JSX.Element {
        const { checked, onChange, label, group } = this.props

        return (
            <div className="radio">
                <label>
                    <input
                        type="radio"
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
