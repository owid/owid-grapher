import * as _ from "lodash-es"
import * as R from "remeda"
import {
    Bounds,
    formatAttributions,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    DisplaySource,
    prepareSourcesForDisplay,
    OwidSource,
    joinTitleFragments,
    getIndicatorCitations,
    openLinkInNewTabAttrs,
    parseTimespan,
    excludeUndefined,
} from "@ourworldindata/utils"
import {
    IndicatorSources,
    IndicatorProcessing,
    SimpleMarkdownText,
    DataCitation,
    OverlayHeader,
    CLOSE_BUTTON_WIDTH,
    CloseButton,
    LoadingIndicator,
} from "@ourworldindata/components"
import * as React from "react"
import cx from "clsx"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { OwidColumnDef, OwidProcessingLevel } from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { SourcesKeyDataTable } from "./SourcesKeyDataTable"
import { SourcesDescriptions } from "./SourcesDescriptions"
import { TabItem, Tabs } from "../tabs/Tabs"
import { TabsWithDropdown } from "../tabs/TabsWithDropdown"
import {
    DEFAULT_GRAPHER_BOUNDS,
    GrapherModal,
    isContinentsVariableId,
} from "../core/GrapherConstants"

// keep in sync with variables in SourcesModal.scss
const MAX_CONTENT_WIDTH = 640
const TAB_PADDING = 8
const TAB_FONT_SIZE = 13
const TAB_GAP = 8
const TAB_TITLE_SPACING = 6

export interface SourcesModalManager {
    isReady?: boolean
    adminBaseUrl?: string
    inputColumnsWithSources: CoreColumn[]
    showAdminControls?: boolean
    activeModal?: GrapherModal
    frameBounds?: Bounds
    base: React.RefObject<HTMLDivElement | null>
    isEmbeddedInADataPage?: boolean
    isInIFrame?: boolean
    isNarrow?: boolean
    fontSize?: number
}

interface SourcesModalProps {
    manager: SourcesModalManager
}

interface SourcesModalTab {
    column: CoreColumn
    title: string
    attribution?: string
    timespan?: string
    label: TabItem
}

@observer
export class SourcesModal extends React.Component<SourcesModalProps> {
    private readonly container = React.createRef<HTMLDivElement>()

    private activeTabKey = ""

    constructor(props: SourcesModalProps) {
        super(props)
        makeObservable<SourcesModal, "activeTabKey">(this, {
            activeTabKey: observable,
        })
    }

    @action override componentDidMount(): void {
        this.activeTabKey = this.tabs[0]?.label.key ?? ""
    }

    @action.bound private setActiveTabKey(key: string): void {
        this.activeTabKey = key
    }

    @computed private get manager(): SourcesModalManager {
        return this.props.manager
    }

    @computed private get frameBounds(): Bounds {
        return this.manager.frameBounds ?? DEFAULT_GRAPHER_BOUNDS
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
        return this.manager.inputColumnsWithSources
    }

    private makeTabLabelString(title: string, attribution?: string): string {
        return `${title} ${attribution ?? ""}`.trim()
    }

    private makeTabLabelElement(
        title: string,
        attribution?: string
    ): React.ReactElement {
        return (
            <>
                {title}
                {attribution && (
                    <span className="attribution">{attribution}</span>
                )}
            </>
        )
    }

    @computed get tabs(): SourcesModalTab[] {
        const columnTabs = this.columns.map((column) => {
            let title = column.titlePublicOrDisplayName.title

            // Historical and projected columns may have the same name,
            // so we add "(projection)" to the title of projected columns
            // to distinguish them
            if (
                column.isProjection &&
                this.columns.some(
                    (c) => title === c.titlePublicOrDisplayName.title
                )
            )
                title += " (projection)"

            const attribution = joinTitleFragments(
                column.titlePublicOrDisplayName.attributionShort,
                column.titlePublicOrDisplayName.titleVariant
            )

            const label = this.makeTabLabelString(title, attribution)

            return { column, title, attribution, label }
        })

        // Indicators that would render the same tab, apart from their
        // date range, share one tab that spans all of their date ranges
        const tabs = Object.values(
            _.groupBy(columnTabs, ({ column, label }) =>
                makeTabMergeKey(label, column)
            )
        ).map((tabsToMerge) => {
            const [firstTab] = tabsToMerge
            return {
                ...firstTab,
                timespan: mergeTimespans(
                    tabsToMerge.map(({ column }) => column.def.timespan)
                ),
            }
        })

        const labelCounts = _.countBy(tabs, (tab) => tab.label)

        return tabs.map(({ column, title, attribution, timespan, label }) => {
            if (labelCounts[label] > 1) {
                const disambiguator = [
                    column.display?.name,
                    column.nonEmptyName,
                ].find(
                    (name) =>
                        name && name !== column.titlePublicOrDisplayName.title
                )
                attribution = joinTitleFragments(disambiguator, attribution)
            }

            return {
                column,
                title,
                attribution,
                timespan,
                label: {
                    key: column.slug,
                    element: this.makeTabLabelElement(title, attribution),
                },
            }
        })
    }

    @computed private get tabLabels(): TabItem[] {
        return this.tabs.map(({ label }) => label)
    }

    @computed private get tabLabelWidths(): number[] {
        return this.tabs.map(({ title, attribution }) =>
            measureTabWidth(title, attribution)
        )
    }

    private renderSource({
        column,
        title,
        timespan,
    }: {
        column: CoreColumn
        title?: string
        timespan?: string
    }): React.ReactElement {
        return (
            <Source
                title={title}
                column={column}
                timespan={timespan}
                editBaseUrl={this.editBaseUrl}
                isEmbeddedInADataPage={
                    this.manager.isEmbeddedInADataPage ?? false
                }
                openLinksInNewTab={this.manager.isInIFrame}
            />
        )
    }

    private renderTabs(): React.ReactElement {
        // Display horizontally scrolling tabs on mobile
        if (this.manager.isNarrow) {
            return (
                <Tabs
                    className="sources-modal-tabs"
                    items={this.tabLabels}
                    selectedKey={this.activeTabKey}
                    onChange={this.setActiveTabKey}
                    variant="scroll"
                />
            )
        }

        // Show all tabs if there are 4 or fewer
        if (this.tabs.length <= 4) {
            return (
                <Tabs
                    className="sources-modal-tabs"
                    items={this.tabLabels}
                    selectedKey={this.activeTabKey}
                    onChange={this.setActiveTabKey}
                    variant="scroll"
                />
            )
        }

        // Find the subset of tabs that fit into a single line
        const getVisibleLabels = (labels: TabItem[]): TabItem[] => {
            // Maximum width available for tabs
            const maxWidth = Math.min(
                MAX_CONTENT_WIDTH,
                this.modalBounds.width - 2 * this.modalPadding
            )

            // Hardcoded width of the "More" button
            const moreButtonWidth = 74

            const visibleLabels: TabItem[] = []
            let currentWidth = moreButtonWidth
            for (const [label, labelWidth] of R.zip(
                labels,
                this.tabLabelWidths
            )) {
                currentWidth += labelWidth + TAB_GAP
                if (currentWidth > maxWidth) break
                visibleLabels.push(label)
            }

            return visibleLabels
        }

        const visibleLabels = getVisibleLabels(this.tabLabels)

        // No need for a dropdown if all tabs are visible
        if (visibleLabels.length === this.tabLabels.length) {
            return (
                <Tabs
                    className="sources-modal-tabs"
                    items={this.tabLabels}
                    selectedKey={this.activeTabKey}
                    onChange={this.setActiveTabKey}
                    variant="scroll"
                />
            )
        }

        // Ensure at least 3 tabs are visible
        const numVisibleTabs = Math.max(3, visibleLabels.length)

        return (
            <TabsWithDropdown
                className="sources-modal-tabs"
                items={this.tabLabels}
                selectedKey={this.activeTabKey}
                onChange={this.setActiveTabKey}
                numVisibleTabs={numVisibleTabs}
                portalContainer={this.container.current ?? undefined}
            />
        )
    }

    private renderMultipleSources(): React.ReactElement {
        const activeTab = this.tabs.find(
            (tab) => tab.label.key === this.activeTabKey
        )

        return (
            <>
                <p className="note-multiple-indicators">
                    This chart is composed of multiple indicators. Select an
                    indicator for more information.
                </p>
                {this.renderTabs()}
                {activeTab && this.renderSource(activeTab)}
            </>
        )
    }

    private renderNoSources(): React.ReactElement {
        return (
            <p className="note-no-sources">
                No source information is available for the data shown in this
                chart.
            </p>
        )
    }

    private renderModalContent(): React.ReactElement | null {
        // Charts fed with external data (e.g. via GrapherLoader.fromCsv) may
        // have no columns with source information at all
        if (this.tabs.length === 0) return this.renderNoSources()
        return this.tabs.length === 1
            ? this.renderSource({
                  column: this.tabs[0].column,
                  timespan: this.tabs[0].timespan,
              })
            : this.renderMultipleSources()
    }

    @action.bound private onDismiss(): void {
        this.manager.activeModal = undefined
    }

    override render(): React.ReactElement {
        return (
            <Modal
                ariaLabel="Sources"
                grapherRef={this.manager.base}
                bounds={this.modalBounds}
                isHeightFixed={true}
                onDismiss={this.onDismiss}
            >
                <div className="sources-modal-content" ref={this.container}>
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

interface SourceContent {
    title: string
    titleFragments?: string
    timespan?: string
    descriptionBelowTitle?: string
    attribution?: string
    owidProcessingLevel?: OwidProcessingLevel
    lastUpdated?: string
    nextUpdate?: string
    unit?: string
    unitConversionFactor: number
    link?: string
    descriptionShort?: string
    descriptionKey?: string
    descriptionFromProducer?: string
    descriptionProcessing?: string
    attributionShort?: string
    additionalInfo?: string
    hasFaqs: boolean
    sourcesForDisplay: DisplaySource[]
    citations: { short: string; long: string }
}

interface SourceProps {
    column: CoreColumn
    title?: string
    timespan?: string
    editBaseUrl?: string
    isEmbeddedInADataPage?: boolean
    openLinksInNewTab?: boolean
}

@observer
export class Source extends React.Component<SourceProps> {
    constructor(props: SourceProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get content(): SourceContent {
        return getSourceContent(this.props.column)
    }

    @computed private get title(): string {
        return this.props.title ?? this.content.title
    }

    @computed private get timespan(): string | undefined {
        return this.props.timespan ?? this.content.timespan
    }

    // On a merged tab, this links to the first indicator only
    @computed private get editUrl(): string | undefined {
        if (!this.props.editBaseUrl) return undefined

        const def: OwidColumnDef = this.props.column.def
        const { owidVariableId, datasetId } = def

        // point user directly to the variable edit page if possible
        if (owidVariableId) {
            return `${this.props.editBaseUrl}/variables/${owidVariableId}`
        }

        // if that's not possible, point user to the dataset edit page
        if (datasetId) {
            return `${this.props.editBaseUrl}/datasets/${datasetId}`
        }

        // we can't link to an edit page for explorers that define the FASTT in TSV
        return undefined
    }

    @computed private get datapageHasFAQSection(): boolean {
        return !!this.props.isEmbeddedInADataPage && this.content.hasFaqs
    }

    @computed private get showDescriptions(): boolean {
        return (
            !!this.content.descriptionKey ||
            !!this.content.descriptionFromProducer ||
            !!this.content.additionalInfo
        )
    }

    @computed protected get sourcesSectionHeading(): string {
        return "The data of this indicator is based on the following sources:"
    }

    protected renderTitle(): React.ReactElement {
        return (
            <h2>
                <span className="title">{this.title}</span>{" "}
                {this.content.titleFragments && (
                    <>
                        <span className="title-fragments">
                            {this.content.titleFragments}
                        </span>{" "}
                    </>
                )}
                {this.editUrl && (
                    <a
                        href={this.editUrl}
                        {...openLinkInNewTabAttrs(this.props.openLinksInNewTab)}
                    >
                        <FontAwesomeIcon icon={faPencilAlt} />
                    </a>
                )}
            </h2>
        )
    }

    override render(): React.ReactElement {
        return (
            <div className="source">
                {this.renderTitle()}
                {this.content.descriptionBelowTitle && (
                    <div className="description-below-title">
                        <SimpleMarkdownText
                            text={this.content.descriptionBelowTitle}
                            openLinksInNewTab={this.props.openLinksInNewTab}
                        />
                    </div>
                )}
                <SourcesKeyDataTable
                    attribution={this.content.attribution}
                    owidProcessingLevel={this.content.owidProcessingLevel}
                    dateRange={this.timespan}
                    lastUpdated={this.content.lastUpdated}
                    nextUpdate={this.content.nextUpdate}
                    unit={this.content.unit}
                    link={this.content.link}
                    unitConversionFactor={this.content.unitConversionFactor}
                    isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                    openLinksInNewTab={this.props.openLinksInNewTab}
                />
                {this.showDescriptions && (
                    <SourcesDescriptions
                        descriptionShort={this.content.descriptionShort}
                        descriptionKey={this.content.descriptionKey}
                        hasFaqEntries={this.datapageHasFAQSection}
                        descriptionFromProducer={
                            this.content.descriptionFromProducer
                        }
                        attributionShort={this.content.attributionShort}
                        additionalInfo={this.content.additionalInfo}
                        isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                        openLinksInNewTab={this.props.openLinksInNewTab}
                    />
                )}
                {this.content.sourcesForDisplay.length > 0 && (
                    <>
                        <h3 className="heading">
                            {this.sourcesSectionHeading}
                        </h3>
                        <IndicatorSources
                            sources={this.content.sourcesForDisplay}
                            isEmbeddedInADataPage={
                                this.props.isEmbeddedInADataPage
                            }
                            openLinksInNewTab={this.props.openLinksInNewTab}
                        />
                    </>
                )}
                <h3 className="heading heading--tight">
                    How we process data at Our World in Data:
                </h3>
                <IndicatorProcessing
                    descriptionProcessing={this.content.descriptionProcessing}
                    openLinksInNewTab={this.props.openLinksInNewTab}
                />
                <h3 className="heading heading--tight">
                    How to cite this data:
                </h3>
                <DataCitation
                    citationShort={this.content.citations.short}
                    citationLong={this.content.citations.long}
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

/** Key shared by indicators whose tabs differ in nothing but a parseable date range */
const makeTabMergeKey = (label: string, column: CoreColumn): string => {
    const { timespan, ...content } = getSourceContent(column)
    const hasDateRange = parseTimespan(timespan ?? "") !== undefined
    return JSON.stringify([
        label,
        content,
        hasDateRange,
        hasDateRange ? undefined : timespan,
    ])
}

const getSourceContent = (column: CoreColumn): SourceContent => {
    const def: OwidColumnDef & { source: OwidSource } = {
        ...column.def,
        source: column.source,
    }
    const { title, attributionShort, titleVariant } =
        column.titlePublicOrDisplayName
    const attributionFragments = getAttributionFragmentsFromVariable(def)

    // The "Continent" indicator curated by OWID is used in many charts but
    // doesn't come with useful source information
    const isContinents =
        !!def.owidVariableId && isContinentsVariableId(def.owidVariableId)

    return {
        title,
        titleFragments: joinTitleFragments(attributionShort, titleVariant),
        timespan: def.timespan,
        descriptionBelowTitle: def.descriptionShort || def.description,
        attribution:
            attributionFragments.length > 0
                ? formatAttributions(attributionFragments)
                : undefined,
        owidProcessingLevel: def.owidProcessingLevel,
        lastUpdated: getLastUpdatedFromVariable(def),
        nextUpdate: getNextUpdateFromVariable(def),
        unit: column.unit,
        unitConversionFactor: column.unitConversionFactor,
        link: def.source.link,
        descriptionShort: def.descriptionShort,
        descriptionKey: def.descriptionKey,
        descriptionFromProducer: def.descriptionFromProducer,
        descriptionProcessing: def.descriptionProcessing,
        attributionShort: def.presentation?.attributionShort,
        additionalInfo: def.source.additionalInfo,
        hasFaqs: (def.presentation?.faqs?.length ?? 0) > 0,
        sourcesForDisplay: isContinents ? [] : prepareSourcesForDisplay(def),
        citations: getIndicatorCitations({
            indicatorTitle: column.titlePublicOrDisplayName,
            origins: def.origins ?? [],
            source: def.source,
            attributions: attributionFragments,
            attributionShort: def.presentation?.attributionShort,
            titleVariant: def.presentation?.titleVariant,
            owidProcessingLevel: def.owidProcessingLevel,
        }),
    }
}

const mergeTimespans = (
    timespans: (string | undefined)[]
): string | undefined => {
    const years = excludeUndefined(
        timespans.map((timespan) => parseTimespan(timespan ?? ""))
    )
    if (timespans.length === 1 || years.length === 0) return timespans[0]
    const firstYear = _.min(years.map((y) => y.firstYear))
    const lastYear = _.max(years.map((y) => y.lastYear))
    return `${firstYear}-${lastYear}`
}
