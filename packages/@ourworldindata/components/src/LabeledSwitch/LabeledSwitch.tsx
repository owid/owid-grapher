import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { Tippy } from "@ourworldindata/utils"

export const LabeledSwitch = ({
    className,
    label,
    value,
    tooltip,
    tracking,
    disabled,
    onToggle,
}: {
    value?: boolean
    label?: string
    tooltip?: string
    tracking?: string
    onToggle: () => any
    className?: string
    disabled?: boolean
}): React.ReactElement => {
    return (
        <div
            className={cx(
                {
                    "labeled-switch": true,
                    "labeled-switch--is-disabled": disabled,
                },
                className
            )}
        >
            <label>
                <input
                    type="checkbox"
                    checked={value}
                    disabled={disabled}
                    onChange={onToggle}
                    data-track-note={tracking}
                />
                <div data-track-note="" className="outer">
                    <div className="inner"></div>
                </div>
                {label}
                {tooltip && (
                    <Tippy
                        content={tooltip}
                        theme="grapher-explanation"
                        placement="top"
                        maxWidth={338}
                    >
                        <FontAwesomeIcon icon={faInfoCircle} />
                    </Tippy>
                )}
            </label>
            {tooltip && (
                <div className="labeled-switch-subtitle">{tooltip}</div>
            )}
        </div>
    )
}
