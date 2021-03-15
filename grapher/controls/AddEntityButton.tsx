import * as React from "react"
import { observer } from "mobx-react"
import { runInAction } from "mobx"

export interface AddEntityButtonManager {
    isSelectingData?: boolean
    entityType?: string
}

@observer
export class AddEntityButton extends React.Component<{
    manager: AddEntityButtonManager
}> {
    render() {
        return (
            <button
                className="addEntityButton clickable"
                onClick={() =>
                    runInAction(
                        () => (this.props.manager.isSelectingData = true)
                    )
                }
                data-track-note="chart-add-entity"
            >
                <span className="icon">
                    <svg width={16} height={16}>
                        <path d="M3,8 h10 m-5,-5 v10" />
                    </svg>
                </span>
                <span className="label">{`Add ${
                    this.props.manager.entityType || "data"
                }`}</span>
            </button>
        )
    }
}
