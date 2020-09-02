import * as React from "react"
import { action, computed } from "mobx"
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
    standalone?: boolean // Until we remove ControlsOverlay have this option to render it for testing
}

@observer
export class NoDataOverlay extends React.Component<{
    bounds: Bounds
    message?: string
    options: NoDataOverlayOptions
}> {
    @action.bound private onDataSelect() {
        this.props.options.isSelectingData = true
    }

    @computed private get message() {
        const { bounds, message, options } = this.props
        return (
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
                        <button className="action" onClick={this.onDataSelect}>
                            <FontAwesomeIcon icon={faPlus} /> Add{" "}
                            {options.entityType}
                        </button>
                    )}
                    {options.canChangeEntity && (
                        <button className="action" onClick={this.onDataSelect}>
                            <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                            {options.entityType}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    render() {
        return this.props.options.standalone ? (
            this.message
        ) : (
            <ControlsOverlay id="no-data">{this.message}</ControlsOverlay>
        )
    }
}
