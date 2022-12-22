import React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft"

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
    @action.bound private onDataSelect(): void {
        this.props.manager.isSelectingData = true
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    render(): JSX.Element {
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
                                <FontAwesomeIcon icon={faRightLeft} /> Change{" "}
                                {entityType}
                            </button>
                        )}
                    </div>
                </div>
            </foreignObject>
        )
    }
}
