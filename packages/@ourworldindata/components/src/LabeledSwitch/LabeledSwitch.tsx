import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import {
    TooltipTrigger,
    Tooltip,
    Button,
    OverlayArrow,
} from "react-aria-components"

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
                "labeled-switch",
                { "labeled-switch--disabled": disabled },
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
                    <TooltipTrigger delay={0}>
                        <Button
                            className="tooltip-trigger"
                            aria-label="More information about this setting"
                        >
                            <FontAwesomeIcon icon={faInfoCircle} />
                        </Button>
                        <Tooltip
                            className="react-aria-tooltip"
                            placement="top"
                            offset={8}
                        >
                            <OverlayArrow className="react-aria-tooltip__overlay-arrow">
                                <svg width={8} height={8} viewBox="0 0 8 8">
                                    <path d="M0 0 L4 4 L8 0" />
                                </svg>
                            </OverlayArrow>
                            {tooltip}
                        </Tooltip>
                    </TooltipTrigger>
                )}
            </label>
            {tooltip && (
                <div className="labeled-switch-subtitle">{tooltip}</div>
            )}
        </div>
    )
}
