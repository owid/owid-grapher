import { useState } from "react"
import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faShareNodes,
    faExpand,
    faCompress,
    faDownload,
    faArrowRight,
    IconDefinition,
    faHeart,
} from "@fortawesome/free-solid-svg-icons"
import {
    ShareMenu,
    ShareMenuManager,
    shareUsingShareApi,
    shouldShareUsingShareApi,
} from "./ShareMenu.js"
import { Bounds } from "@ourworldindata/utils"
import classNames from "classnames"
import {
    DEFAULT_GRAPHER_BOUNDS,
    GrapherModal,
} from "../core/GrapherConstants.js"

export interface ActionButtonsManager extends ShareMenuManager {
    isAdmin?: boolean
    isShareMenuActive?: boolean
    hideShareButton?: boolean
    hideExploreTheDataButton?: boolean
    isInIFrame?: boolean
    canonicalUrl?: string
    isInFullScreenMode?: boolean
    activeModal?: GrapherModal
    hideFullScreenButton?: boolean
}

// keep in sync with sass variables in ActionButtons.scss
const BUTTON_HEIGHT = 32
const PADDING_BETWEEN_BUTTONS = 8
const PADDING_BETWEEN_ICON_AND_LABEL = 8
const PADDING_X = 12

const BUTTON_WIDTH_ICON_ONLY = BUTTON_HEIGHT

interface ActionButtonsProps {
    manager: ActionButtonsManager
    maxWidth?: number
}

@observer
export class ActionButtons extends React.Component<ActionButtonsProps> {
    constructor(props: ActionButtonsProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): ActionButtonsManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_GRAPHER_BOUNDS.width
    }

    @computed get height(): number {
        return BUTTON_HEIGHT
    }

    @computed private get widthWithButtonLabels(): number {
        const {
            buttonCount,
            hasDownloadButton,
            hasDonateButton,
            hasShareButton,
            hasFullScreenButton,
            hasExploreTheDataButton,
            downloadButtonWithLabelWidth,
            donateButtonWithLabelWidth,
            shareButtonWithLabelWidth,
            fullScreenButtonWithLabelWidth,
            exploreTheDataButtonWithLabelWidth,
        } = this

        let width = 0
        if (hasDownloadButton) {
            width += downloadButtonWithLabelWidth
        }
        if (hasShareButton) {
            width += shareButtonWithLabelWidth
        }
        if (hasFullScreenButton) {
            width += fullScreenButtonWithLabelWidth
        }
        if (hasDonateButton) {
            width += donateButtonWithLabelWidth
        }
        if (hasExploreTheDataButton) {
            width += exploreTheDataButtonWithLabelWidth
        }

        return width + (buttonCount - 1) * PADDING_BETWEEN_BUTTONS
    }

    @computed get widthWithIconsOnly(): number {
        const {
            buttonCount,
            hasExploreTheDataButton,
            exploreTheDataButtonWidth,
        } = this

        let width = 0
        let remainingButtonCount = buttonCount

        // When shown, the explore the data button always has a label
        if (hasExploreTheDataButton) {
            width += exploreTheDataButtonWidth
            remainingButtonCount--
        }
        width += remainingButtonCount * BUTTON_WIDTH_ICON_ONLY
        width += (buttonCount - 1) * PADDING_BETWEEN_BUTTONS

        return width
    }

    @computed get showButtonLabels(): boolean {
        const { maxWidth, widthWithButtonLabels } = this
        return widthWithButtonLabels <= maxWidth
    }

    @computed get width(): number {
        const { showButtonLabels, widthWithButtonLabels, widthWithIconsOnly } =
            this
        return showButtonLabels ? widthWithButtonLabels : widthWithIconsOnly
    }

    private static computeButtonWidth(label: string): number {
        const labelWidth = Bounds.forText(label, { fontSize: 13 }).width
        return (
            2 * PADDING_X +
            12 + // icon width
            PADDING_BETWEEN_ICON_AND_LABEL +
            labelWidth
        )
    }

    @computed private get downloadButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Download")
    }

    @computed private get shareButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Share")
    }

    @computed private get fullScreenButtonLabel(): string {
        const { isInFullScreenMode } = this.manager
        return isInFullScreenMode ? "Exit full-screen" : "Enter full-screen"
    }

    @computed private get fullScreenButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth(this.fullScreenButtonLabel)
    }

    @computed private get donateButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Donate")
    }

    @computed private get exploreTheDataButtonWithLabelWidth(): number {
        return ActionButtons.computeButtonWidth("Explore the data")
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

    @computed private get fullScreenButtonWidth(): number {
        const {
            hasFullScreenButton,
            showButtonLabels,
            fullScreenButtonWithLabelWidth,
        } = this
        if (!hasFullScreenButton) return 0
        if (!showButtonLabels) return BUTTON_WIDTH_ICON_ONLY
        return fullScreenButtonWithLabelWidth
    }

    @computed private get donateButtonWidth(): number {
        const {
            hasDonateButton,
            showButtonLabels,
            donateButtonWithLabelWidth,
        } = this
        if (!hasDonateButton) return 0
        if (!showButtonLabels) return BUTTON_WIDTH_ICON_ONLY
        return donateButtonWithLabelWidth
    }

    // the "Explore the data" button is never shown without a label
    @computed private get exploreTheDataButtonWidth(): number {
        const { hasExploreTheDataButton, exploreTheDataButtonWithLabelWidth } =
            this
        if (!hasExploreTheDataButton) return 0
        return exploreTheDataButtonWithLabelWidth
    }

    @action.bound toggleShareMenu(): void {
        if (shouldShareUsingShareApi(this.manager)) {
            void shareUsingShareApi(this.manager)
            return
        }
        this.manager.isShareMenuActive = !this.manager.isShareMenuActive
    }

    @action.bound toggleFullScreenMode(): void {
        this.manager.isInFullScreenMode = !this.manager.isInFullScreenMode
    }

    @computed private get hasDownloadButton(): boolean {
        return true
    }

    @computed private get hasDonateButton(): boolean {
        return !!this.manager.isInIFrame && !this.manager.isAdmin
    }

    @computed private get hasShareButton(): boolean {
        return (
            !this.manager.hideShareButton && ShareMenu.shouldShow(this.manager)
        )
    }

    @computed private get hasFullScreenButton(): boolean {
        return !this.manager.hideFullScreenButton && !this.manager.isInIFrame
    }

    @computed private get hasExploreTheDataButton(): boolean {
        const { manager } = this
        return !manager.hideExploreTheDataButton || !!manager.isInIFrame
    }

    @computed private get buttonCount(): number {
        let count = 0
        if (this.hasDownloadButton) count += 1
        if (this.hasShareButton) count += 1
        if (this.hasFullScreenButton) count += 1
        if (this.hasDonateButton) count += 1
        if (this.hasExploreTheDataButton) count += 1
        return count
    }

    private renderShareMenu(): React.ReactElement {
        // distance between the right edge of the share button and the inner border of the frame
        let right = 0
        if (this.hasFullScreenButton)
            right += PADDING_BETWEEN_BUTTONS + this.fullScreenButtonWidth
        if (this.hasExploreTheDataButton)
            right += PADDING_BETWEEN_BUTTONS + this.exploreTheDataButtonWidth

        return (
            <ShareMenu
                manager={this.manager}
                onDismiss={this.toggleShareMenu}
                right={right}
            />
        )
    }

    override render(): React.ReactElement {
        const { manager } = this
        const { isShareMenuActive } = manager

        return (
            <div
                className="ActionButtons"
                style={{ height: this.height, width: this.width }}
            >
                <ul>
                    {this.hasDownloadButton && (
                        <li style={{ width: this.downloadButtonWidth }}>
                            <ActionButton
                                label="Download"
                                dataTrackNote="chart_click_download"
                                showLabel={this.showButtonLabels}
                                icon={faDownload}
                                onClick={(e): void => {
                                    this.manager.activeModal =
                                        GrapherModal.Download
                                    e.stopPropagation()
                                }}
                            />
                        </li>
                    )}
                    {this.hasShareButton && (
                        <li style={{ width: this.shareButtonWidth }}>
                            <ActionButton
                                label="Share"
                                dataTrackNote="chart_click_share"
                                showLabel={this.showButtonLabels}
                                icon={faShareNodes}
                                onClick={(e): void => {
                                    this.toggleShareMenu()
                                    e.stopPropagation()
                                }}
                                isActive={this.manager.isShareMenuActive}
                            />
                            {isShareMenuActive && this.renderShareMenu()}
                        </li>
                    )}
                    {this.hasFullScreenButton && (
                        <li style={{ width: this.fullScreenButtonWidth }}>
                            <ActionButton
                                label={this.fullScreenButtonLabel}
                                dataTrackNote="chart_click_fullscreen"
                                showLabel={this.showButtonLabels}
                                icon={
                                    manager.isInFullScreenMode
                                        ? faCompress
                                        : faExpand
                                }
                                onClick={this.toggleFullScreenMode}
                            />
                        </li>
                    )}
                    {this.hasDonateButton && (
                        <li style={{ width: this.donateButtonWidth }}>
                            <ActionButton
                                className="ActionButton--donate"
                                label="Donate"
                                dataTrackNote="chart_click_donate"
                                showLabel={this.showButtonLabels}
                                icon={faHeart}
                                href="https://ourworldindata.org/donate"
                            />
                        </li>
                    )}
                    {this.hasExploreTheDataButton && (
                        <li style={{ width: this.exploreTheDataButtonWidth }}>
                            <ActionButton
                                label="Explore the data"
                                dataTrackNote="chart_click_exploredata"
                                icon={faArrowRight}
                                iconPlacement="right"
                                href={manager.canonicalUrl}
                                className="ActionButton--exploreData"
                                showLabel={true}
                            />
                        </li>
                    )}
                </ul>
            </div>
        )
    }
}

export function ActionButton(props: {
    label: string
    icon: IconDefinition
    iconPlacement?: "left" | "right"
    href?: string
    width?: number
    dataTrackNote?: string
    onClick?: React.MouseEventHandler<HTMLDivElement>
    onMouseDown?: React.MouseEventHandler<HTMLDivElement>
    showLabel?: boolean
    isActive?: boolean
    style?: React.CSSProperties
    className?: string
}): React.ReactElement {
    const [showTooltip, setShowTooltip] = useState(false)

    const buttonClassnames = classNames({
        active: props.isActive,
        "icon-only": !props.showLabel,
    })

    const iconPlacement = props.iconPlacement ?? "left"

    const buttonContents = (
        <>
            {iconPlacement === "left" && <FontAwesomeIcon icon={props.icon} />}
            {props.showLabel && <span className="label">{props.label}</span>}
            {iconPlacement === "right" && <FontAwesomeIcon icon={props.icon} />}
        </>
    )

    return (
        <div
            className={classNames("ActionButton", props.className)}
            style={props.style}
            data-track-note={props.dataTrackNote}
            onClick={(e: React.MouseEvent<HTMLDivElement>): void => {
                if (props.onClick) props.onClick(e)
                setShowTooltip(false)
            }}
            onMouseDown={props.onMouseDown}
            onMouseEnter={(): void => {
                if (!props.showLabel) setShowTooltip(true)
            }}
            onMouseLeave={(): void => {
                setShowTooltip(false)
            }}
        >
            {props.href ? (
                <a
                    href={props.href}
                    target="_blank"
                    className={buttonClassnames}
                    aria-label={props.label}
                    rel="noopener"
                >
                    {buttonContents}
                </a>
            ) : (
                <button
                    className={buttonClassnames}
                    aria-label={props.label}
                    type="button"
                >
                    {buttonContents}
                </button>
            )}
            {showTooltip && <div className="hover-label">{props.label}</div>}
        </div>
    )
}
