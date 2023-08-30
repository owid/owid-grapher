import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faTable,
    faEarthAmericas,
    faChartLine,
} from "@fortawesome/free-solid-svg-icons"
import { GrapherTabOption } from "../core/GrapherConstants"

const icons = {
    [GrapherTabOption.table]: faTable,
    [GrapherTabOption.chart]: faChartLine,
    [GrapherTabOption.map]: faEarthAmericas,
} as const

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    isNarrow?: boolean
    isMedium?: boolean
}

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get availableTabs(): GrapherTabOption[] {
        return this.manager.availableTabs || []
    }

    render(): JSX.Element {
        const { manager } = this
        return (
            <ul
                className={
                    "ContentSwitchers" +
                    (manager.isMedium && !manager.isNarrow ? " narrow" : "")
                }
            >
                {this.availableTabs.map((tab) => (
                    <Tab
                        key={tab}
                        tab={tab}
                        isActive={tab === manager.tab}
                        onClick={(): void => {
                            manager.tab = tab
                        }}
                    />
                ))}
            </ul>
        )
    }
}

function Tab(props: {
    tab: GrapherTabOption
    isActive?: boolean
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
}): JSX.Element {
    const className = "tab clickable" + (props.isActive ? " active" : "")
    return (
        <li key={props.tab} className={className}>
            <a
                onClick={props.onClick}
                data-track-note={"chart_click_" + props.tab}
            >
                <FontAwesomeIcon icon={icons[props.tab]} />
                {props.tab}
            </a>
        </li>
    )
}
