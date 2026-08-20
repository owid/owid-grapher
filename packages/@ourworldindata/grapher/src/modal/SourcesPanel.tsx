import * as React from "react"
import cx from "clsx"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { BodyPortal, CLOSE_BUTTON_WIDTH } from "@ourworldindata/components"
import { isTargetOutsideElement } from "../chart/ChartUtils"
import { MAX_CONTENT_WIDTH, SourcesContent } from "./SourcesContent"
import { getSourcesEditBaseUrl, SourcesModalManager } from "./SourcesModal"

// keep in sync with variables in SourcesPanel.scss
const PANEL_WIDTH = 560
const PANEL_PADDING = 24
const PANEL_PADDING_NARROW = 16

// mirrors GrapherState's isNarrow breakpoint, applied to the panel width
const NARROW_PANEL_WIDTH = 420

export interface SourcesPanelManager extends SourcesModalManager {
    /** Used to size the panel; the grapher's own bounds are irrelevant here */
    windowInnerWidth?: number
}

interface SourcesPanelProps {
    manager: SourcesPanelManager
}

/**
 * The "Sources and methodology" overlay as a page-level panel anchored to the
 * right edge of the viewport. Used when Grapher isn't rendered inside an
 * iframe, i.e. on our own pages; embeds get the in-frame {@link SourcesModal}.
 *
 * The panel is portaled to the document body so that it can escape the grapher
 * frame and cover the site chrome.
 */
@observer
export class SourcesPanel extends React.Component<SourcesPanelProps> {
    private readonly panel = React.createRef<HTMLDivElement>()

    constructor(props: SourcesPanelProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): SourcesPanelManager {
        return this.props.manager
    }

    @computed private get panelWidth(): number {
        const windowWidth = this.manager.windowInnerWidth ?? PANEL_WIDTH
        return Math.min(PANEL_WIDTH, windowWidth)
    }

    @computed private get isNarrow(): boolean {
        return this.panelWidth <= NARROW_PANEL_WIDTH
    }

    @computed private get panelPadding(): number {
        return this.isNarrow ? PANEL_PADDING_NARROW : PANEL_PADDING
    }

    @computed private get contentWidth(): number {
        return this.panelWidth - 2 * this.panelPadding
    }

    @computed private get maxTabsWidth(): number {
        return Math.min(MAX_CONTENT_WIDTH, this.contentWidth)
    }

    @computed private get showStickyHeader(): boolean {
        // the close button only floats beside the content column if there's
        // room for it there; otherwise it goes into a sticky header
        return (
            (this.contentWidth - MAX_CONTENT_WIDTH) / 2 < CLOSE_BUTTON_WIDTH + 2
        )
    }

    @action.bound private onDismiss(): void {
        this.manager.activeModal = undefined
    }

    @action.bound private onOverlayClick(e: React.MouseEvent): void {
        if (
            this.panel.current &&
            isTargetOutsideElement(e.target, this.panel.current)
        )
            this.onDismiss()
    }

    @action.bound private onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.onDismiss()
    }

    override componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    override componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    override render(): React.ReactElement {
        return (
            <BodyPortal>
                <div
                    className="grapher-sources-panel-overlay"
                    onClick={this.onOverlayClick}
                >
                    <div
                        className={cx("grapher-sources-panel", {
                            "grapher-sources-panel--narrow": this.isNarrow,
                            // The sources styles are shared with the in-frame
                            // modal, which keys its responsive treatment off
                            // these two classes (see grapher.scss). They only
                            // ever appear in `.GrapherComponent`-scoped rules
                            // alongside the sources ones, so reusing them here
                            // pulls in no grapher layout.
                            GrapherComponentSmall: this.isNarrow,
                            GrapherComponentSemiNarrow: this.isNarrow,
                        })}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Sources and methodology"
                        ref={this.panel}
                    >
                        <SourcesContent
                            columns={this.manager.inputColumnsWithSources}
                            isReady={this.manager.isReady}
                            isNarrow={this.isNarrow}
                            maxTabsWidth={this.maxTabsWidth}
                            editBaseUrl={getSourcesEditBaseUrl(this.manager)}
                            isEmbeddedInADataPage={
                                this.manager.isEmbeddedInADataPage
                            }
                            showStickyHeader={this.showStickyHeader}
                            onDismiss={this.onDismiss}
                        />
                    </div>
                </div>
            </BodyPortal>
        )
    }
}
