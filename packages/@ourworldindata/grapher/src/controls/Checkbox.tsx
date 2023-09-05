import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheck } from "@fortawesome/free-solid-svg-icons"

export class Checkbox extends React.Component<{
    checked: boolean
    label: string
    onChange: () => any
}> {
    render(): JSX.Element {
        const { label, checked } = this.props

        return (
            <div className="checkbox">
                <label>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={this.props.onChange}
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
