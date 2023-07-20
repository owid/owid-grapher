import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    GrapherTabOption,
    GrapherTabOverlayOption,
} from "../core/GrapherConstants"

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
                            {tabName}
                        </a>
                    </li>
                ))}
            </ul>
        )
    }
}
