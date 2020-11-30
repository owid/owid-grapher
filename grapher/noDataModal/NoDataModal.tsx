import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "clientUtils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"

export interface NoDataModalManager {
    canChangeEntity?: boolean
    canAddData?: boolean
    isSelectingData?: boolean
    entityType?: string
}

@observer
export class NoDataModal extends React.Component<{
    bounds?: Bounds
    message?: string
    manager: NoDataModalManager
}> {
    @action.bound private onDataSelect() {
        this.props.manager.isSelectingData = true
    }

    @computed private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    render() {
        const { message, manager } = this.props
        const entityType = manager.entityType
        const { bounds } = this
        return (
            <foreignObject
                x={bounds.left}
                y={bounds.top}
                width={bounds.width}
                height={bounds.height}
            >
                <div className="NoData">
                    <p className="message">{message || "No available data"}</p>
                    <div className="actions">
                        {manager.canAddData && (
                            <button
                                className="action"
                                onClick={this.onDataSelect}
                            >
                                <FontAwesomeIcon icon={faPlus} /> Add{" "}
                                {entityType}
                            </button>
                        )}
                        {manager.canChangeEntity && (
                            <button
                                className="action"
                                onClick={this.onDataSelect}
                            >
                                <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                                {entityType}
                            </button>
                        )}
                    </div>
                </div>
            </foreignObject>
        )
    }
}
