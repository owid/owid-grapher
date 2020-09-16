import * as React from "react"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { runInAction } from "mobx"

@observer
export class AddEntityButton extends React.Component<{
    grapher: Grapher
}> {
    render() {
        return (
            <button
                className="addEntityButton clickable"
                onClick={() =>
                    runInAction(
                        () => (this.props.grapher.isSelectingData = true)
                    )
                }
                data-track-note="chart-add-entity"
            >
                <span className="icon">
                    <svg width={16} height={16}>
                        <path d="M3,8 h10 m-5,-5 v10" />
                    </svg>
                </span>
                <span className="label">{`Add ${this.props.grapher.entityType}`}</span>
            </button>
        )
    }
}
