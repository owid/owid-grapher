import {
    Bounds,
    DEFAULT_BOUNDS,
    uniq,
    sum,
    zip,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    excludeUndefined,
    DisplaySource,
    prepareSourcesForDisplay,
    OwidSource,
    IndicatorTitleWithFragments,
    joinTitleFragments,
    getCitationShort,
    getCitationLong,
} from "@ourworldindata/utils"
import {
    IndicatorSources,
    IndicatorProcessing,
    SimpleMarkdownText,
    DataCitation,
    OverlayHeader,
    CLOSE_BUTTON_WIDTH,
    CloseButton,
} from "@ourworldindata/components"
import React from "react"
import cx from "classnames"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidColumnDef } from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { SourcesKeyDataTable } from "./SourcesKeyDataTable"
import { SourcesDescriptions } from "./SourcesDescriptions"
import { TabLabel, Tabs } from "../tabs/Tabs"
import { ExpandableTabs } from "../tabs/ExpandableTabs"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { isContinentsVariableId } from "../core/GrapherConstants"

// keep in sync with variables in SourcesModal.scss
const MAX_CONTENT_WIDTH = 640
const TAB_PADDING = 16
const TAB_FONT_SIZE = 13
const TAB_GAP = 8
const TAB_TITLE_SPACING = 8

export interface SourcesModalManager {
    isReady?: boolean
    adminBaseUrl?: string
    columnsWithSourcesExtensive: CoreColumn[]
    showAdminControls?: boolean
    isSourcesModalOpen?: boolean
    frameBounds?: Bounds
    isEmbeddedInADataPage?: boolean
    isNarrow?: boolean
    fontSize?: number
}

interface SourcesModalProps {
    manager: SourcesModalManager
}

interface SourcesModalState {
    activeTabIndex: number
}

@observer
export class SourcesModal extends React.Component<
    SourcesModalProps,
    SourcesModalState
> {
    constructor(props: SourcesModalProps) {
        super(props)
        this.state = {
            activeTabIndex: 0,
        }
    }

    @computed private get manager(): SourcesModalManager {
        return this.props.manager
    }

    @computed private get frameBounds(): Bounds {
        return this.manager.frameBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = MAX_CONTENT_WIDTH + 220
        // using 15px instead of 16px to make sure the modal fully covers the OWID logo in the header
        const padWidth = Math.max(15, (this.frameBounds.width - maxWidth) / 2)
        return this.frameBounds.padHeight(15).padWidth(padWidth)
    }

    @computed private get showStickyHeader(): boolean {
        const modalWidth = this.modalBounds.width - 2 * this.modalPadding
        return (modalWidth - MAX_CONTENT_WIDTH) / 2 < CLOSE_BUTTON_WIDTH + 2
    }

    @computed private get modalPadding(): number {
        return 1.5 * (this.manager.fontSize ?? 16)
    }

    @computed private get editBaseUrl(): string | undefined {
        if (!this.manager.showAdminControls) return undefined
        return `${this.props.manager.adminBaseUrl}/admin`
    }

    @computed private get columns(): CoreColumn[] {
        return this.manager.columnsWithSourcesExtensive
    }

    @computed private get tabLabels(): TabLabel[] {
        return this.columns.map((column) => {
            const attribution = joinTitleFragments(
                column.titlePublicOrDisplayName.attributionShort,
                column.titlePublicOrDisplayName.titleVariant
            )
            return {
                element: (
                    <React.Fragment key={column.slug}>
                        {column.titlePublicOrDisplayName.title}
                        {attribution && (
                            <span className="attribution">{attribution}</span>
                        )}
                    </React.Fragment>
                ),
            }
        })
    }

    @computed private get tabLabelWidths(): number[] {
        return this.columns.map((column) => {
            const title = `${column.titlePublicOrDisplayName.title}`
            const fragments = joinTitleFragments(
                column.titlePublicOrDisplayName.attributionShort,
                column.titlePublicOrDisplayName.titleVariant
            )
            return measureTabWidth(title, fragments) + TAB_GAP
        })
    }

    private renderSource(
        column: CoreColumn | undefined
    ): React.ReactElement | null {
        if (!column) return null
        return (
            <Source
                column={column}
                editBaseUrl={this.editBaseUrl}
                isEmbeddedInADataPage={
                    this.manager.isEmbeddedInADataPage ?? false
                }
            />
        )
    }

    private renderTabs(): React.ReactElement {
        const activeIndex = this.state.activeTabIndex
        const setActiveIndex = (index: number) =>
            this.setState({
                activeTabIndex: index,
            })

        // tabs are clipped to this width
        const maxTabWidth = 240

        // on mobile, we show a horizontally scrolling tabs
        if (this.manager.isNarrow) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    horizontalScroll={true}
                    maxTabWidth={maxTabWidth}
                />
            )
        }

        // maximum width available for tabs
        const maxWidth = Math.min(
            MAX_CONTENT_WIDTH,
            this.modalBounds.width - 2 * this.modalPadding - 10 // wiggle room
        )

        // check if all tab labels fit into a single line
        if (sum(this.tabLabelWidths) <= maxWidth) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                />
            )
        }

        const clippedLabelWidths = this.tabLabelWidths.map((labelWidth) =>
            Math.min(labelWidth, maxTabWidth + TAB_GAP)
        )

        // check if all tab labels fit into a single line when they are clipped
        if (sum(clippedLabelWidths) <= maxWidth) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    maxTabWidth={maxTabWidth}
                />
            )
        }

        // compute the subset of tabs that fit into a single line
        const getVisibleLabels = (labels: TabLabel[]): TabLabel[] => {
            // take width of the "Show more" button into account
            let width =
                measureTabWidth("Show more") +
                13 + // icon width
                6 // icon padding

            const visibleLabels: TabLabel[] = []
            for (const [label, labelWidth] of zip(labels, clippedLabelWidths)) {
                width += labelWidth as number
                if (width > maxWidth) break
                visibleLabels.push(label!)
            }

            return visibleLabels
        }

        // if only a single label would be visible, we prefer tabs with horizontal scrolling
        const visibleLabels = getVisibleLabels(this.tabLabels)
        if (visibleLabels.length <= 1) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    horizontalScroll={true}
                    maxTabWidth={maxTabWidth}
                />
            )
        }

        return (
            <ExpandableTabs
                labels={this.tabLabels}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                getVisibleLabels={getVisibleLabels}
                maxTabWidth={maxTabWidth}
            />
        )
    }

    private renderMultipleSources(): React.ReactElement {
        return (
            <>
                <p className="note-multiple-indicators">
                    This chart is composed of multiple indicators. Select an
                    indicator for more information.
                </p>
                {this.renderTabs()}
                {this.renderSource(this.columns[this.state.activeTabIndex])}
            </>
        )
    }

    private renderModalContent(): React.ReactElement | null {
        return this.columns.length === 1
            ? this.renderSource(this.columns[0])
            : this.renderMultipleSources()
    }

    @action.bound private onDismiss(): void {
        this.manager.isSourcesModalOpen = false
    }

    render(): React.ReactElement {
        return (
            <Modal
                bounds={this.modalBounds}
                isHeightFixed={true}
                onDismiss={this.onDismiss}
            >
                <div className="sources-modal-content">
                    {this.showStickyHeader ? (
                        <OverlayHeader title="" onDismiss={this.onDismiss} />
                    ) : (
                        <CloseButton
                            className="close-button--top-right"
                            onClick={this.onDismiss}
                        />
                    )}
                    <div
                        className={cx("scrollable", {
                            "scrollable--pad-top": !this.showStickyHeader,
                        })}
                    >
                        <div className="centered">
                            {this.manager.isReady ? (
                                this.renderModalContent()
                            ) : (
                                <LoadingIndicator />
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        )
    }
}

@observer
export class Source extends React.Component<{
    column: CoreColumn
    editBaseUrl?: string
    isEmbeddedInADataPage?: boolean
}> {
    @computed get column(): CoreColumn {
        return this.props.column
    }

    @computed get def(): OwidColumnDef & { source?: OwidSource } {
        return { ...this.column.def, source: this.column.source }
    }

    @computed get citationShort(): string {
        return getCitationShort(
            this.def.origins ?? [],
            getAttributionFragmentsFromVariable(this.def),
            this.def.owidProcessingLevel
        )
    }

    @computed get citationLong(): string {
        return getCitationLong(
            this.title,
            this.def.origins ?? [],
            this.source,
            getAttributionFragmentsFromVariable(this.def),
            this.def.presentation?.attributionShort,
            this.def.presentation?.titleVariant,
            this.def.owidProcessingLevel,
            undefined
        )
    }

    @computed private get source(): OwidSource {
        return this.def.source ?? {}
    }

    @computed private get title(): IndicatorTitleWithFragments {
        return this.column.titlePublicOrDisplayName
    }

    @computed private get editUrl(): string | undefined {
        if (!this.props.editBaseUrl) return undefined

        // point user directly to the variable edit page if possible
        if (this.def.owidVariableId) {
            return `${this.props.editBaseUrl}/variables/${this.def.owidVariableId}`
        }

        // if that's not possible, point user to the dataset edit page
        if (this.def.datasetId) {
            return `${this.props.editBaseUrl}/datasets/${this.def.datasetId}`
        }

        // we can't link to an edit page for explorers that define the FASTT in TSV
        return undefined
    }

    @computed private get producers(): string[] {
        if (!this.def.origins) return []
        return uniq(excludeUndefined(this.def.origins.map((o) => o.producer)))
    }

    @computed get attributions(): string | undefined {
        const attributionFragments =
            getAttributionFragmentsFromVariable(this.def) ?? this.producers
        if (attributionFragments.length === 0) return undefined
        return attributionFragments.join(", ")
    }

    @computed get lastUpdated(): string | undefined {
        return getLastUpdatedFromVariable(this.def)
    }

    @computed get nextUpdate(): string | undefined {
        return getNextUpdateFromVariable(this.def)
    }

    @computed get unit(): string | undefined {
        return this.column.unit
    }

    @computed private get datapageHasFAQSection(): boolean {
        const faqCount = this.def.presentation?.faqs?.length ?? 0
        return !!this.props.isEmbeddedInADataPage && faqCount > 0
    }

    @computed private get showDescriptions(): boolean {
        return (
            (this.def.descriptionKey && this.def.descriptionKey.length > 0) ||
            !!this.def.descriptionFromProducer ||
            !!this.source.additionalInfo
        )
    }

    @computed private get sourcesForDisplay(): DisplaySource[] {
        return prepareSourcesForDisplay(this.def)
    }

    @computed protected get sourcesSectionHeading(): string {
        return "The data of this indicator is based on the following sources:"
    }

    @computed private get hideSourcesForDisplay(): boolean {
        // the "Continent" variable curated by OWID is used in many charts but doesn't come with useful source information.
        // that's why we hide the sources section for this indicator for now, but we might decide to show it in the future.
        return (
            !!this.def.owidVariableId &&
            isContinentsVariableId(this.def.owidVariableId)
        )
    }

    @computed private get descriptionBelowTitle(): string | undefined {
        return this.def.descriptionShort || this.def.description
    }

    protected renderTitle(): React.ReactElement {
        return (
            <h2>
                <span className="title">{this.title.title}</span>{" "}
                {(this.title.attributionShort || this.title.titleVariant) && (
                    <>
                        <span className="title-fragments">
                            {joinTitleFragments(
                                this.title.attributionShort,
                                this.title.titleVariant
                            )}
                        </span>{" "}
                    </>
                )}
                {this.editUrl && (
                    <a href={this.editUrl} target="_blank" rel="noopener">
                        <FontAwesomeIcon icon={faPencilAlt} />
                    </a>
                )}
            </h2>
        )
    }

    render(): React.ReactElement {
        return (
            <div className="source">
                {this.renderTitle()}
                {this.descriptionBelowTitle && (
                    <div className="description-below-title">
                        <SimpleMarkdownText text={this.descriptionBelowTitle} />
                    </div>
                )}
                <SourcesKeyDataTable
                    attribution={this.attributions}
                    owidProcessingLevel={this.def.owidProcessingLevel}
                    dateRange={this.def.timespan}
                    lastUpdated={this.lastUpdated}
                    nextUpdate={this.nextUpdate}
                    unit={this.unit}
                    link={this.source.link}
                    unitConversionFactor={this.column.unitConversionFactor}
                    isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                />
                {this.showDescriptions && (
                    <SourcesDescriptions
                        descriptionShort={this.def.descriptionShort}
                        descriptionKey={this.def.descriptionKey ?? []}
                        hasFaqEntries={this.datapageHasFAQSection}
                        descriptionFromProducer={
                            this.def.descriptionFromProducer
                        }
                        attributionShort={
                            this.def.presentation?.attributionShort
                        }
                        additionalInfo={this.source.additionalInfo}
                        isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                    />
                )}
                {!this.hideSourcesForDisplay &&
                    this.sourcesForDisplay &&
                    this.sourcesForDisplay.length > 0 && (
                        <>
                            <h3 className="heading">
                                {this.sourcesSectionHeading}
                            </h3>
                            <IndicatorSources
                                sources={this.sourcesForDisplay}
                                isEmbeddedInADataPage={
                                    this.props.isEmbeddedInADataPage
                                }
                            />
                        </>
                    )}
                <h3 className="heading heading--tight">
                    How we process data at Our World in Data:
                </h3>
                <IndicatorProcessing
                    descriptionProcessing={this.def.descriptionProcessing}
                />
                <h3 className="heading heading--tight">
                    How to cite this data:
                </h3>
                <DataCitation
                    citationShort={this.citationShort}
                    citationLong={this.citationLong}
                />
            </div>
        )
    }
}

const measureTabWidth = (label: string, secondary?: string): number => {
    const getWidth = (text: string) =>
        Bounds.forText(text, { fontSize: TAB_FONT_SIZE }).width

    const labelWidth = getWidth(label)
    const secondaryTextWidth = secondary
        ? getWidth(secondary) + TAB_TITLE_SPACING
        : 0
    const padding = 2 * TAB_PADDING
    const borderWidth = 2

    return labelWidth + secondaryTextWidth + padding + borderWidth
}
