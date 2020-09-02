import * as React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { ControlsOverlay } from "charts/controls/Controls"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"

interface NoDataOverlayOptions {
    canChangeEntity: boolean
    canAddData: boolean
    isSelectingData: boolean
    entityType: string
}

@observer
export class NoDataOverlay extends React.Component<{
    bounds: Bounds
    message?: string
    options: NoDataOverlayOptions
}> {
    @action.bound onDataSelect() {
        this.props.options.isSelectingData = true
    }

    render() {
        const { bounds, message, options } = this.props
        return (
            <ControlsOverlay id="no-data">
                <div
                    className="NoData"
                    style={{
                        position: "absolute",
                        top: bounds.top,
                        left: bounds.left,
                        width: bounds.width,
                        height: bounds.height
                    }}
                >
                    <p className="message">{message || "No available data"}</p>
                    <div className="actions">
                        {options.canAddData && (
                            <button
                                className="action"
                                onClick={this.onDataSelect}
                            >
                                <FontAwesomeIcon icon={faPlus} /> Add{" "}
                                {options.entityType}
                            </button>
                        )}
                        {options.canChangeEntity && (
                            <button
                                className="action"
                                onClick={this.onDataSelect}
                            >
                                <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                                {options.entityType}
                            </button>
                        )}
                    </div>
                </div>
            </ControlsOverlay>
        )
    }
}
