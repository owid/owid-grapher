import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    GrapherTabOption,
    GrapherTabOverlayOption,
} from "../core/GrapherConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faShareNodes,
    faExpand,
    faDownload,
} from "@fortawesome/free-solid-svg-icons"
import { ShareMenu, ShareMenuManager } from "./ShareMenu"
import { DEFAULT_BOUNDS, Bounds } from "@ourworldindata/utils"

export interface ActionButtonsManager extends ShareMenuManager {
    availableTabOverlays?: GrapherTabOverlayOption[]
    currentTab?: GrapherTabOption | GrapherTabOverlayOption
    isShareMenuActive?: boolean
    hideShareTabButton?: boolean
    isInIFrame?: boolean
    canonicalUrl?: string
}

// keep in sync with sass variables in ActionButtons.scss
const BUTTON_SIZE = 32
const PADDING_BETWEEN_BUTTONS = 8
const PADDING_BETWEEN_ICON_AND_LABEL = 4

@observer
export class ActionButtons extends React.Component<{
    manager: ActionButtonsManager
    height?: number
    maxWidth?: number
}> {
    @computed private get manager(): ActionButtonsManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed get height(): number {
        return BUTTON_SIZE
    }

    @computed private get widthWithButtonLabels(): number {
        const {
            buttonCount,
            hasDownloadOverlayTab,
            hasShareButton,
            hasOpenInNewTabButton,
            downloadButtonWithLabelWidth,
            shareButtonWithLabelWidth,
            openInNewTabButtonWithLabelWidth,
        } = this

        let width = 0
        if (hasDownloadOverlayTab) {
            width += downloadButtonWithLabelWidth
        }
        if (hasShareButton) {
            width += shareButtonWithLabelWidth
        }
        if (hasOpenInNewTabButton) {
            width += openInNewTabButtonWithLabelWidth
        }

        return width + (buttonCount - 1) * PADDING_BETWEEN_BUTTONS
    }

    @computed private get showButtonLabels(): boolean {
        return this.widthWithButtonLabels < 0.33 * this.maxWidth
    }

    @computed get width(): number {
        const { buttonCount, showButtonLabels, widthWithButtonLabels } = this

        if (showButtonLabels) {
            return widthWithButtonLabels
        } else {
            return (
                buttonCount * BUTTON_SIZE +
                (buttonCount - 1) * PADDING_BETWEEN_BUTTONS
            )
        }
    }

    @computed private get downloadButtonWithLabelWidth(): number {
        const text = "Download"
        const textWidth = Bounds.forText(text, { fontSize: 13 }).width
        return BUTTON_SIZE + PADDING_BETWEEN_ICON_AND_LABEL + textWidth
    }

    @computed private get shareButtonWithLabelWidth(): number {
        const text = "Share"
        const textWidth = Bounds.forText(text, { fontSize: 13 }).width
        return BUTTON_SIZE + PADDING_BETWEEN_ICON_AND_LABEL + textWidth
    }

    @computed private get openInNewTabButtonWithLabelWidth(): number {
        const text = "Open in a new tab"
        const textWidth = Bounds.forText(text, { fontSize: 13 }).width
        return BUTTON_SIZE + PADDING_BETWEEN_ICON_AND_LABEL + textWidth
    }

    @computed private get downloadButtonWidth(): number {
        const {
            hasDownloadOverlayTab,
            showButtonLabels,
            downloadButtonWithLabelWidth,
        } = this
        if (!hasDownloadOverlayTab) return 0
        if (!showButtonLabels) return BUTTON_SIZE
        return downloadButtonWithLabelWidth
    }

    @computed private get shareButtonWidth(): number {
        const { hasShareButton, showButtonLabels, shareButtonWithLabelWidth } =
            this
        if (!hasShareButton) return 0
        if (!showButtonLabels) return BUTTON_SIZE
        return shareButtonWithLabelWidth
    }

    @computed private get openInNewTabButtonWidth(): number {
        const {
            hasOpenInNewTabButton,
            showButtonLabels,
            openInNewTabButtonWithLabelWidth,
        } = this
        if (!hasOpenInNewTabButton) return 0
        if (!showButtonLabels) return BUTTON_SIZE
        return openInNewTabButtonWithLabelWidth
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
                            style={{ width: this.downloadButtonWidth }}
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
                                {this.showButtonLabels && (
                                    <div className="label">Download</div>
                                )}
                            </a>
                        </li>
                    )}
                    {this.hasShareButton && (
                        <li
                            className="clickable icon"
                            style={{ width: this.shareButtonWidth }}
                        >
                            <a
                                title="Share"
                                onClick={this.onShareMenu}
                                data-track-note="chart_click_share"
                            >
                                <FontAwesomeIcon icon={faShareNodes} />
                                {this.showButtonLabels && (
                                    <div className="label">Share</div>
                                )}
                            </a>
                        </li>
                    )}
                    {this.hasOpenInNewTabButton && (
                        <li
                            className="clickable icon"
                            style={{ width: this.openInNewTabButtonWidth }}
                        >
                            <a
                                title="Open chart in new tab"
                                href={manager.canonicalUrl}
                                data-track-note="chart_click_newtab"
                                target="_blank"
                                rel="noopener"
                            >
                                <FontAwesomeIcon icon={faExpand} />
                                {this.showButtonLabels && (
                                    <div className="label">
                                        Open in a new tab
                                    </div>
                                )}
                            </a>
                        </li>
                    )}
                </ul>
                {shareMenuElement}
            </div>
        )
    }
}
