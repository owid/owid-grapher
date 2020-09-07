import { Bounds } from "grapher/utils/Bounds"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { DataTable } from "./DataTable"

// Client-side data export from chart
@observer
export class TableTab extends React.Component<{
    bounds: Bounds
    grapher: Grapher
}> {
    @computed get bounds() {
        return this.props.bounds
    }

    render() {
        const { bounds } = this

        return (
            <div
                className="tableTab"
                style={{ ...bounds.toCSS(), position: "absolute" }}
            >
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                    }}
                >
                    <DataTable grapher={this.props.grapher} />
                </div>
            </div>
        )
    }
}
