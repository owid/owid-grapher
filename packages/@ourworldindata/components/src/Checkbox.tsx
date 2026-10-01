import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"

export const Checkbox = ({
    className,
    checked,
    onChange,
    label,
    disabled,
    id,
    name,
    value,
    "data-test": testHook,
}: {
    className?: string
    checked: boolean
    onChange: React.ChangeEventHandler<HTMLInputElement>
    label: React.ReactNode
    disabled?: boolean
    id?: string
    // Set both when the checkbox is part of a form that gets submitted, rather
    // than only read through onChange.
    name?: string
    value?: string
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
                    name={name}
                    value={value}
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
