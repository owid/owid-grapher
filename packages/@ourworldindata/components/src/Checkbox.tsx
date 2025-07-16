import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"

export const Checkbox = ({
    className,
    checked,
    onChange,
    label,
    disabled,
    id,
    "data-test": testHook,
}: {
    className?: string
    checked: boolean
    onChange: React.ChangeEventHandler<HTMLInputElement>
    label: React.ReactNode
    disabled?: boolean
    id?: string
    "data-test"?: string
}) => {
    return (
        <div
            className={cx(
                "checkbox",
                { "checkbox--disabled": disabled },
                className
            )}
        >
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
