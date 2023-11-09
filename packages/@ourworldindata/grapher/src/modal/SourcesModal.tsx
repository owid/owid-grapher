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
} from "@ourworldindata/utils"
import {
    IndicatorSources,
    IndicatorProcessing,
} from "@ourworldindata/components"
import React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { CoreColumn, OwidColumnDef } from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { SourcesKeyDataTable } from "./SourcesKeyDataTable"
import { SourcesDescriptions } from "./SourcesDescriptions"
import { Tabs } from "../tabs/Tabs"
import { ExpandableTabs } from "../tabs/ExpandableTabs"

// keep in sync with variables in SourcesModal.scss
const MAX_WIDTH = 832

export interface SourcesModalManager {
    adminBaseUrl?: string
    columnsWithSourcesExtensive: CoreColumn[]
    showAdminControls?: boolean
    isSourcesModalOpen?: boolean
    tabBounds?: Bounds
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

    @computed private get tabBounds(): Bounds {
        return this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        // using 15px instead of 16px to make sure the modal fully covers the OWID logo in the header
        return this.tabBounds.pad(15)
    }

    @computed private get editBaseUrl(): string | undefined {
        if (!this.manager.showAdminControls) return undefined
        return `${this.props.manager.adminBaseUrl}/admin/datasets`
    }

    @computed private get columns(): CoreColumn[] {
        return this.manager.columnsWithSourcesExtensive
    }

    @computed private get tabLabels(): string[] {
        return this.columns.map((column) => column.nonEmptyDisplayName)
    }

    private renderSource(column: CoreColumn | undefined): JSX.Element | null {
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

    private renderTabs(): JSX.Element {
        const activeIndex = this.state.activeTabIndex
        const setActiveIndex = (index: number) =>
            this.setState({
                activeTabIndex: index,
            })

        if (this.manager.isNarrow)
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    horizontalScroll={true}
                />
            )

        // width available for tabs
        const modalPadding = 1.5 * (this.manager.fontSize ?? 16)
        const maxWidth = Math.min(
            MAX_WIDTH,
            this.modalBounds.width - 2 * modalPadding - 10 // wiggle room
        )

        const labelWidths = this.tabLabels.map(
            (label) => measureTabWidth(label) + 8 // right padding
        )

        // check if all tabs fit into a single line
        if (sum(labelWidths) <= maxWidth)
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                />
            )

        // get a subset of tabs that fit into a single line
        const getVisibleLabels = (labels: string[]) => {
            // take width of the "Show more" button into account
            let width =
                measureTabWidth("Show more") +
                13 + // icon width
                6 // icon padding

            const visibleLabels: string[] = []
            for (const [label, labelWidth] of zip(labels, labelWidths)) {
                width += labelWidth as number
                if (width > maxWidth) break
                visibleLabels.push(label as string)
            }

            return visibleLabels
        }

        // if only a single label would be visible, we prefer tabs with horizontal scrolling
        const visibleLabels = getVisibleLabels(this.tabLabels)
        if (visibleLabels.length <= 1)
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    horizontalScroll={true}
                />
            )

        return (
            <ExpandableTabs
                labels={this.tabLabels}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                getVisibleLabels={getVisibleLabels}
            />
        )
    }

    render(): JSX.Element {
        return (
            <Modal
                onDismiss={action(
                    () => (this.manager.isSourcesModalOpen = false)
                )}
                bounds={this.modalBounds}
                isHeightFixed={true}
            >
                <div className="SourcesModalContent">
                    {this.columns.length === 1 ? (
                        this.renderSource(this.columns[0])
                    ) : (
                        <>
                            <p className="note-multiple-indicators">
                                This data includes several indicators. Select an
                                indicator for more information.
                            </p>
                            {this.renderTabs()}
                            {this.renderSource(
                                this.columns[this.state.activeTabIndex]
                            )}
                        </>
                    )}
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
    @computed private get def(): OwidColumnDef & { source?: OwidSource } {
        return { ...this.props.column.def, source: this.props.column.source }
    }

    @computed private get source(): OwidSource {
        return this.def.source ?? {}
    }

    @computed private get title(): string {
        return this.props.column.nonEmptyDisplayName
    }

    @computed private get editUrl(): string | undefined {
        // there will not be a datasetId for explorers that define the FASTT in TSV
        if (!this.props.editBaseUrl || !this.def.datasetId) return undefined
        return `${this.props.editBaseUrl}/${this.def.datasetId}`
    }

    @computed private get producers(): string[] {
        if (!this.def.origins) return []
        return uniq(excludeUndefined(this.def.origins.map((o) => o.producer)))
    }

    @computed private get attributions(): string | undefined {
        const attributionFragments =
            getAttributionFragmentsFromVariable(this.def) ?? this.producers
        if (attributionFragments.length === 0) return undefined
        return attributionFragments.join(", ")
    }

    @computed private get lastUpdated(): string | undefined {
        return getLastUpdatedFromVariable(this.def)
    }

    @computed private get nextUpdate(): string | undefined {
        return getNextUpdateFromVariable(this.def)
    }

    @computed private get unit(): string | undefined {
        return this.def.display?.unit ?? this.def.unit
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

    render(): JSX.Element {
        return (
            <div className="source">
                <h2>
                    {this.title}{" "}
                    {this.editUrl && (
                        <a href={this.editUrl} target="_blank" rel="noopener">
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </a>
                    )}
                </h2>
                {this.def.descriptionShort && (
                    <p>{this.def.descriptionShort}</p>
                )}
                <SourcesKeyDataTable
                    attribution={this.attributions}
                    owidProcessingLevel={this.def.owidProcessingLevel}
                    dateRange={this.def.timespan}
                    lastUpdated={this.lastUpdated}
                    nextUpdate={this.nextUpdate}
                    unit={this.unit}
                    link={this.source.link}
                    unitConversionFactor={
                        this.props.column.unitConversionFactor
                    }
                    isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                    hideTopBorder={!this.def.descriptionShort}
                    hideBottomBorder={
                        this.showDescriptions &&
                        (!this.def.descriptionKey ||
                            this.def.descriptionKey.length === 0)
                    }
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
                {this.sourcesForDisplay &&
                    this.sourcesForDisplay.length > 0 && (
                        <>
                            <h3 className="heading">
                                This data is based on the following sources:
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
            </div>
        )
    }
}

// keep in sync with .Tabs__tab styles in SourcesModal.scss
const measureTabWidth = (label: string): number => {
    const maxWidth = 240
    const computedWidth =
        2 * 16 + // padding
        Bounds.forText(label, { fontSize: 13 }).width +
        2 // border
    return Math.min(maxWidth, computedWidth)
}
