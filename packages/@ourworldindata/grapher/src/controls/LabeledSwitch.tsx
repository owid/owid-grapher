import React from "react"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { Tippy } from "@ourworldindata/utils"

@observer
export class LabeledSwitch extends React.Component<{
    value?: boolean
    label?: string
    tooltip?: string
    tracking?: string
    onToggle: () => any
}> {
    render(): JSX.Element {
        const { label, value, tooltip, tracking } = this.props

        return (
            <div className="labeled-switch">
                <label>
                    <input
                        type="checkbox"
                        checked={value}
                        onChange={this.props.onToggle}
                        data-track-note={tracking}
                    />
                    <div data-track-note="" className="outer">
                        <div className="inner"></div>
                    </div>
                    {label}
                    {tooltip && (
                        <Tippy
                            content={tooltip}
                            theme="settings"
                            placement="top"
                            // arrow={false}
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
