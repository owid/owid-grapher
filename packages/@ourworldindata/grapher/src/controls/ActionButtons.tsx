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
    IconDefinition,
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
            hasEnterFullScreenButton,
            downloadButtonWithLabelWidth,
            shareButtonWithLabelWidth,
            enterFullScreenButtonWithLabelWidth,
        } = this

        let width = 0
        if (hasDownloadButton) {
            width += downloadButtonWithLabelWidth
        }
        if (hasShareButton) {
            width += shareButtonWithLabelWidth
        }
        if (hasEnterFullScreenButton) {
            width += enterFullScreenButtonWithLabelWidth
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

    @computed private get enterFullScreenButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Enter full-screen")
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

    @computed private get enterFullScreenButtonWidth(): number {
        const {
            hasEnterFullScreenButton,
            showButtonLabels,
            enterFullScreenButtonWithLabelWidth,
        } = this
        if (!hasEnterFullScreenButton) return 0
        if (!showButtonLabels) return BUTTON_WIDTH_ICON_ONLY
        return enterFullScreenButtonWithLabelWidth
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

    @computed private get hasEnterFullScreenButton(): boolean {
        return !this.manager.isInIFrame
    }

    @computed private get buttonCount(): number {
        let count = 0
        if (this.hasDownloadButton) count += 1
        if (this.hasShareButton) count += 1
        if (this.hasEnterFullScreenButton) count += 1
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
                        <ActionButton
                            width={this.downloadButtonWidth}
                            label="Download"
                            title="Download as .png or .svg"
                            dataTrackNote="chart_click_download"
                            showLabel={this.showButtonLabels}
                            icon={faDownload}
                            onClick={():
                                | GrapherTabOption
                                | GrapherTabOverlayOption =>
                                (manager.currentTab =
                                    GrapherTabOverlayOption.download)
                            }
                        />
                    )}
                    {this.hasShareButton && (
                        <ActionButton
                            width={this.shareButtonWidth}
                            label="Share"
                            dataTrackNote="chart_click_share"
                            showLabel={this.showButtonLabels}
                            icon={faShareNodes}
                            onClick={this.onShareMenu}
                        />
                    )}
                    {this.hasEnterFullScreenButton && (
                        <ActionButton
                            width={this.enterFullScreenButtonWidth}
                            label="Enter full-screen"
                            dataTrackNote="chart_click_fullscreen"
                            showLabel={this.showButtonLabels}
                            icon={faExpand}
                            // eslint-disable-next-line
                            onClick={() => {}}
                        />
                    )}
                </ul>
                {shareMenuElement}
            </div>
        )
    }
}

function ActionButton(props: {
    width: number
    dataTrackNote: string
    onClick: () => void
    showLabel: boolean
    label: string
    icon: IconDefinition
    title?: string
}): JSX.Element {
    return (
        <li
            className="clickable"
            style={{
                height: BUTTON_HEIGHT,
                width: props.width,
            }}
        >
            <button
                title={props.title ?? props.label}
                data-track-note={props.dataTrackNote}
                onClick={props.onClick}
            >
                <FontAwesomeIcon icon={props.icon} />
                {props.showLabel && <div className="label">{props.label}</div>}
            </button>
        </li>
    )
}
