import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    GrapherTabOption,
    GrapherTabOverlayOption,
} from "../core/GrapherConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faShareAlt,
    faExpand,
    faDownload,
} from "@fortawesome/free-solid-svg-icons"
import { ShareMenu, ShareMenuManager } from "./ShareMenu"

export interface ActionButtonsManager extends ShareMenuManager {
    availableTabOverlays?: GrapherTabOverlayOption[]
    currentTab?: GrapherTabOption | GrapherTabOverlayOption
    isShareMenuActive?: boolean
    hideShareTabButton?: boolean
    isInIFrame?: boolean
    canonicalUrl?: string
}

const BUTTON_SIZE = 30
const MARGIN_BETWEEN_BUTTONS = 5

@observer
export class ActionButtons extends React.Component<{
    manager: ActionButtonsManager
    height?: number
}> {
    @computed private get manager(): ActionButtonsManager {
        return this.props.manager
    }

    @computed get height(): number {
        return BUTTON_SIZE
    }

    @computed get width(): number {
        const { buttonCount } = this
        return (
            buttonCount * this.height +
            (buttonCount - 1) * MARGIN_BETWEEN_BUTTONS
        )
    }

    @action.bound onShareMenu(): void {
        this.manager.isShareMenuActive = !this.manager.isShareMenuActive
    }

    @computed private get availableTabOverlays(): GrapherTabOverlayOption[] {
        return this.manager.availableTabOverlays || []
    }

    @computed private get hasDownloadOverlayTab(): boolean {
        return this.availableTabOverlays.includes(
            GrapherTabOverlayOption.download
        )
    }

    @computed private get hasShareButton(): boolean {
        return !this.manager.hideShareTabButton
    }

    @computed private get hasOpenInNewTabButton(): boolean {
        return !!this.manager.isInIFrame
    }

    @computed private get buttonCount(): number {
        let count = 0
        if (this.hasDownloadOverlayTab) count += 1
        if (this.hasShareButton) count += 1
        if (this.hasOpenInNewTabButton) count += 1
        return count
    }

    render(): JSX.Element {
        const { manager } = this
        const { isShareMenuActive } = manager

        const shareMenuElement = isShareMenuActive && (
            <ShareMenu manager={manager} onDismiss={this.onShareMenu} />
        )

        return (
            <div
                className="ActionButtons"
                style={{ height: this.height, width: this.width }}
            >
                <ul>
                    {this.hasDownloadOverlayTab && (
                        <li
                            className={
                                "tab clickable icon download-tab-button" +
                                (manager.currentTab ===
                                GrapherTabOverlayOption.download
                                    ? " active"
                                    : "")
                            }
                            title="Download as .png or .svg"
                        >
                            <a
                                data-track-note="chart_click_download"
                                onClick={():
                                    | GrapherTabOption
                                    | GrapherTabOverlayOption =>
                                    (manager.currentTab =
                                        GrapherTabOverlayOption.download)
                                }
                            >
                                <FontAwesomeIcon icon={faDownload} />
                            </a>
                        </li>
                    )}
                    {this.hasShareButton && (
                        <li className="clickable icon icon-only">
                            <a
                                title="Share"
                                onClick={this.onShareMenu}
                                data-track-note="chart_click_share"
                            >
                                <FontAwesomeIcon icon={faShareAlt} />
                            </a>
                        </li>
                    )}
                    {this.hasOpenInNewTabButton && (
                        <li className="clickable icon icon-only">
                            <a
                                title="Open chart in new tab"
                                href={manager.canonicalUrl}
                                data-track-note="chart_click_newtab"
                                target="_blank"
                                rel="noopener"
                            >
                                <FontAwesomeIcon icon={faExpand} />
                            </a>
                        </li>
                    )}
                </ul>
                {shareMenuElement}
            </div>
        )
    }
}
