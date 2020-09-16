import React from "react"
import { CollapsibleList } from "./CollapsibleList/CollapsibleList"

export const ControlsRowHeight = 45

export class ControlsRow extends React.Component<{
    controls: React.ReactElement[]
}> {
    render() {
        return this.props.controls.length ? (
            <div className="controlsRow">
                <CollapsibleList key={this.props.controls.length}>
                    {this.props.controls}
                </CollapsibleList>
            </div>
        ) : null
    }
}
