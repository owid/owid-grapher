import * as _ from "lodash-es"
import * as R from "remeda"
import {
    Bounds,
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
    LoadingIndicator,
} from "@ourworldindata/components"
import * as React from "react"
import cx from "classnames"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { OwidColumnDef } from "@ourworldindata/types"
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
    isEmbeddedInADataPage?: boolean
    isNarrow?: boolean
    fontSize?: number
}

interface SourcesModalProps {
    manager: SourcesModalManager
}

@observer
export class SourcesModal extends React.Component<SourcesModalProps> {
    private container = React.createRef<HTMLDivElement>()

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

    @computed private get tabs(): {
        column: CoreColumn
        label: TabItem
    }[] {
        return _.uniqBy(
            this.columns.map((column) => {
                const title = column.titlePublicOrDisplayName.title
                const attribution = joinTitleFragments(
                    column.titlePublicOrDisplayName.attributionShort,
                    column.titlePublicOrDisplayName.titleVariant
                )
                return {
                    column,
                    label: {
                        key: this.makeTabLabelString(title, attribution),
                        element: this.makeTabLabelElement(title, attribution),
                    },
                }
            }),
            // deduplicate tabs by their label
            (tab) => tab.label.key
        )
    }

    @computed private get tabLabels(): TabItem[] {
        return this.tabs.map(({ label }) => label)
    }

    @computed private get tabLabelWidths(): number[] {
        return this.tabs.map(({ column }) => {
            const title = `${column.titlePublicOrDisplayName.title}`
            const fragments = joinTitleFragments(
                column.titlePublicOrDisplayName.attributionShort,
                column.titlePublicOrDisplayName.titleVariant
            )
            return measureTabWidth(title, fragments)
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
        const activeColumn = this.tabs.find(
            (tab) => tab.label.key === this.activeTabKey
        )?.column

        return (
            <>
                <p className="note-multiple-indicators">
                    This chart is composed of multiple indicators. Select an
                    indicator for more information.
                </p>
                {this.renderTabs()}
                {this.renderSource(activeColumn)}
            </>
        )
    }

    private renderModalContent(): React.ReactElement | null {
        return this.tabs.length === 1
            ? this.renderSource(this.tabs[0].column)
            : this.renderMultipleSources()
    }

    @action.bound private onDismiss(): void {
        this.manager.activeModal = undefined
    }

    override render(): React.ReactElement {
        return (
            <Modal
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

interface SourceProps {
    column: CoreColumn
    editBaseUrl?: string
    isEmbeddedInADataPage?: boolean
}

@observer
export class Source extends React.Component<SourceProps> {
    constructor(props: SourceProps) {
        super(props)
        makeObservable(this)
    }

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
            undefined,
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
        return _.uniq(excludeUndefined(this.def.origins.map((o) => o.producer)))
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
                    <a href={this.editUrl}>
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
