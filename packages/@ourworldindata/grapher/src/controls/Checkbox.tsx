import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheck } from "@fortawesome/free-solid-svg-icons"

export class Checkbox extends React.Component<{
    checked: boolean
    onChange: () => any
    label: string | React.ReactNode
}> {
    render(): JSX.Element {
        const { checked, onChange, label } = this.props

        return (
            <div className="checkbox">
                <label>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={onChange}
                    />
                    <div className="custom">
                        {checked && <FontAwesomeIcon icon={faCheck} />}
                    </div>
                    <div className="label">{label}</div>
                </label>
            </div>
        )
    }
}
