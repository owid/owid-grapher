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
const PADDING_BETWEEN_BUTTONS = 8
const PADDING_BETWEEN_ICON_AND_LABEL = 4

const BUTTON_HEIGHT = 32
const BUTTON_WIDTH_ICON_ONLY = BUTTON_HEIGHT

@observer
export class ActionButtons extends React.Component<{
    manager: ActionButtonsManager
    maxWidth?: number
    availableWidth?: number
}> {
    @computed private get manager(): ActionButtonsManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed protected get availableWidth(): number {
        return this.props.availableWidth ?? this.maxWidth
    }

    @computed get height(): number {
        return BUTTON_HEIGHT
    }

    @computed private get widthWithButtonLabels(): number {
        const {
            buttonCount,
            hasDownloadButton,
            hasShareButton,
            hasOpenInNewTabButton,
            downloadButtonWithLabelWidth,
            shareButtonWithLabelWidth,
            openInNewTabButtonWithLabelWidth,
        } = this

        let width = 0
        if (hasDownloadButton) {
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
        const { availableWidth, widthWithButtonLabels, maxWidth } = this
        if (widthWithButtonLabels <= availableWidth) return true
        return widthWithButtonLabels < 0.33 * maxWidth
    }

    @computed get width(): number {
        const { buttonCount, showButtonLabels, widthWithButtonLabels } = this

        if (showButtonLabels) {
            return widthWithButtonLabels
        } else {
            return (
                buttonCount * BUTTON_WIDTH_ICON_ONLY +
                (buttonCount - 1) * PADDING_BETWEEN_BUTTONS
            )
        }
    }

    private static computeButtonWidth(label: string): number {
        const labelWidth = Bounds.forText(label, { fontSize: 13 }).width
        return (
            BUTTON_WIDTH_ICON_ONLY + PADDING_BETWEEN_ICON_AND_LABEL + labelWidth
        )
    }

    @computed private get downloadButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Download")
    }

    @computed private get shareButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Share")
    }

    @computed private get openInNewTabButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Open in a new tab")
    }

    @computed private get downloadButtonWidth(): number {
        const {
            hasDownloadButton,
            showButtonLabels,
            downloadButtonWithLabelWidth,
        } = this
        if (!hasDownloadButton) return 0
        if (!showButtonLabels) return BUTTON_WIDTH_ICON_ONLY
        return downloadButtonWithLabelWidth
    }

    @computed private get shareButtonWidth(): number {
        const { hasShareButton, showButtonLabels, shareButtonWithLabelWidth } =
            this
        if (!hasShareButton) return 0
        if (!showButtonLabels) return BUTTON_WIDTH_ICON_ONLY
        return shareButtonWithLabelWidth
    }

    @computed private get openInNewTabButtonWidth(): number {
        const {
            hasOpenInNewTabButton,
            showButtonLabels,
            openInNewTabButtonWithLabelWidth,
        } = this
        if (!hasOpenInNewTabButton) return 0
        if (!showButtonLabels) return BUTTON_WIDTH_ICON_ONLY
        return openInNewTabButtonWithLabelWidth
    }

    @action.bound onShareMenu(): void {
        this.manager.isShareMenuActive = !this.manager.isShareMenuActive
    }

    @computed private get availableTabOverlays(): GrapherTabOverlayOption[] {
        return this.manager.availableTabOverlays || []
    }

    @computed private get hasDownloadButton(): boolean {
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
        if (this.hasDownloadButton) count += 1
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
                    {this.hasDownloadButton && (
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
