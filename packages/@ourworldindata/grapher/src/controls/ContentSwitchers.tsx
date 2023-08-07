import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faTable,
    faEarthAmericas,
    faChartLine,
} from "@fortawesome/free-solid-svg-icons"
import {
    GrapherTabOption,
    GrapherTabOverlayOption,
} from "../core/GrapherConstants"

const icons = {
    [GrapherTabOption.table]: faTable,
    [GrapherTabOption.chart]: faEarthAmericas,
    [GrapherTabOption.map]: faChartLine,
} as const

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    currentTab?: GrapherTabOption | GrapherTabOverlayOption
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
            <ul className="ContentSwitchers">
                {this.availableTabs.map((tabName) => (
                    <li
                        key={tabName}
                        className={
                            "tab clickable" +
                            (tabName === manager.currentTab ? " active" : "")
                        }
                    >
                        <a
                            onClick={(): void => {
                                manager.currentTab = tabName
                            }}
                            data-track-note={"chart_click_" + tabName}
                        >
                            <FontAwesomeIcon icon={icons[tabName]} />
                            {tabName}
                        </a>
                    </li>
                ))}
            </ul>
        )
    }
}
