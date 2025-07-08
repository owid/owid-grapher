import * as React from "react"
import cx from "classnames"

export const RadioButton = ({
    className,
    checked,
    onChange,
    label,
    group,
    disabled,
    id,
    "data-test": testHook,
}: {
    className?: string
    checked: boolean
    onChange: React.ChangeEventHandler<HTMLInputElement>
    label: React.ReactNode
    group?: string
    disabled?: boolean
    id?: string
    "data-test"?: string
}) => {
    return (
        <div className={cx("radio", className)}>
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
