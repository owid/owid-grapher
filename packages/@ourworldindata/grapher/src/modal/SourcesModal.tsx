import {
    Bounds,
    DEFAULT_BOUNDS,
    uniq,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    excludeUndefined,
} from "@ourworldindata/utils"
import {
    IndicatorKeyData,
    IndicatorDescriptions,
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

export interface SourcesModalManager {
    adminBaseUrl?: string
    columnsWithSourcesExtensive: CoreColumn[]
    showAdminControls?: boolean
    isSourcesModalOpen?: boolean
    tabBounds?: Bounds
    isEmbeddedInADataPage?: boolean
}

@observer
export class SourcesModal extends React.Component<{
    manager: SourcesModalManager
}> {
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

    render(): JSX.Element {
        const { columnsWithSourcesExtensive } = this.manager
        return (
            <Modal
                onDismiss={action(
                    () => (this.manager.isSourcesModalOpen = false)
                )}
                bounds={this.modalBounds}
            >
                <div className="SourcesModalContent">
                    {columnsWithSourcesExtensive.map((column) => (
                        <Source
                            key={column.slug}
                            column={column}
                            editBaseUrl={this.editBaseUrl}
                            isEmbeddedInADataPage={
                                this.manager.isEmbeddedInADataPage
                            }
                        />
                    ))}
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
    @computed private get def(): OwidColumnDef {
        return this.props.column.def
    }

    @computed private get title(): string {
        return this.def.display?.name || this.def.name || ""
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
            !!this.def.source?.additionalInfo
        )
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
                {this.attributions && this.def.timespan && this.lastUpdated && (
                    <IndicatorKeyData
                        attribution={this.attributions}
                        owidProcessingLevel={this.def.owidProcessingLevel}
                        dateRange={this.def.timespan}
                        lastUpdated={this.lastUpdated}
                        nextUpdate={this.nextUpdate}
                        unit={this.unit}
                        isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                    />
                )}
                {this.showDescriptions && (
                    <IndicatorDescriptions
                        descriptionShort={this.def.descriptionShort}
                        descriptionKey={this.def.descriptionKey ?? []}
                        hasFaqEntries={this.datapageHasFAQSection}
                        descriptionFromProducer={
                            this.def.descriptionFromProducer
                        }
                        attributionShort={
                            this.def.presentation?.attributionShort
                        }
                        additionalInfo={this.def.source?.additionalInfo}
                        isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                    />
                )}
                {this.def.origins && this.def.origins.length > 0 && (
                    <>
                        <h3 className="heading">
                            This data is based on the following sources:
                        </h3>
                        <IndicatorSources
                            origins={this.def.origins}
                            isEmbeddedInADataPage={
                                this.props.isEmbeddedInADataPage
                            }
                        />
                    </>
                )}
                <h3 className="heading">
                    How we process data at Our World in Data:
                </h3>
                <IndicatorProcessing
                    descriptionProcessing={this.def.descriptionProcessing}
                />
            </div>
        )
    }
}
