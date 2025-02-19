import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"

export class Checkbox extends React.Component<{
    checked: boolean
    onChange: React.ChangeEventHandler<HTMLInputElement>
    label: React.ReactNode
    disabled?: boolean
    id?: string
    "data-test"?: string
}> {
    render(): React.ReactElement {
        const { checked, onChange, label, disabled, id } = this.props
        const testHook = this.props["data-test"]

        return (
            <div className={cx("checkbox", { "checkbox--disabled": disabled })}>
                <label>
                    <input
                        id={id}
                        type="checkbox"
                        data-test={testHook}
                        checked={checked}
                        onChange={onChange}
                        disabled={disabled}
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
