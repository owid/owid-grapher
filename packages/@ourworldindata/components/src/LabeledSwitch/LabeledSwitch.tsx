import * as React from "react"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { Tippy } from "@ourworldindata/utils"

@observer
export class LabeledSwitch extends React.Component<{
    value?: boolean
    label?: string
    tooltip?: string
    tracking?: string
    onToggle: () => any
    className?: string
    disabled?: boolean
}> {
    render(): React.ReactElement {
        const {
            className,
            label,
            value,
            tooltip,
            tracking,
            disabled,
            onToggle,
        } = this.props

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
}
