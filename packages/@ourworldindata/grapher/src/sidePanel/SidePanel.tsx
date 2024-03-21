import React from "react"
import { observer } from "mobx-react"
import { computed } from "mobx"
import { Bounds } from "@ourworldindata/utils"

@observer
export class SidePanel extends React.Component<{
    bounds: Bounds
    title?: string
    children: React.ReactNode
}> {
    @computed private get bounds(): Bounds {
        return this.props.bounds
    }

    render(): JSX.Element {
        return (
            <div
                className="SidePanel"
                style={{
                    width: this.bounds.width,
                    height: this.bounds.height,
                }}
            >
                {this.props.title && (
                    <h3 className="title">{this.props.title}</h3>
                )}
                {this.props.children}
            </div>
        )
    }
}
