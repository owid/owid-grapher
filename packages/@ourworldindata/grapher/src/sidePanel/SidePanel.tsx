import React from "react"
import cx from "classnames"
import { observer } from "mobx-react"
import { computed } from "mobx"
import { Bounds } from "@ourworldindata/utils"
import { GRAPHER_SCROLLABLE_CONTAINER_CLASS } from "../core/GrapherConstants"

@observer
export class SidePanel extends React.Component<{
    bounds: Bounds
    title: string
    children: React.ReactNode
}> {
    @computed private get bounds(): Bounds {
        return this.props.bounds
    }

    render(): JSX.Element {
        return (
            <div
                className="side-panel"
                style={{
                    width: this.bounds.width,
                    height: this.bounds.height,
                }}
            >
                <h3 className="side-panel__header grapher_h5-black-caps grapher_light">
                    {this.props.title}
                </h3>
                <div
                    className={cx(
                        "side-panel__scrollable",
                        GRAPHER_SCROLLABLE_CONTAINER_CLASS
                    )}
                >
                    {this.props.children}
                </div>
            </div>
        )
    }
}
