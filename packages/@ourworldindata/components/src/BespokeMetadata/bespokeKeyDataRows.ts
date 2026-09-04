import { BespokeMetadata } from "@ourworldindata/types"
import {
    getAttributionFragmentsFromBespokeMetadata,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
} from "@ourworldindata/utils"
import {
    makeDateRange,
    makeLastUpdated,
    makeNextUpdate,
    makeSource,
    makeUnit,
} from "../IndicatorKeyData/IndicatorKeyData.js"

export interface BespokeMetadataKeyDataRow {
    label: string
    value: React.ReactNode
    isFullWidth?: boolean
    labelClassName?: string
}

export function getBespokeKeyDataRows(
    metadata: BespokeMetadata
): BespokeMetadataKeyDataRow[] {
    if (!metadata.title) return []

    const attributions = getAttributionFragmentsFromBespokeMetadata(metadata)

    const lastUpdated = getLastUpdatedFromVariable(metadata)
    const nextUpdate = lastUpdated
        ? getNextUpdateFromVariable(metadata)
        : undefined

    return [
        {
            label: "Data source",
            value: makeSource({
                attribution: attributions.join("; "),
                owidProcessingLevel: metadata.processingLevel,
                isEmbeddedInADataPage: false,
            }),
            labelClassName: "metadata-box-key-data__key--source",
        },
        {
            label: "Unit",
            value: makeUnit({ unit: metadata.unit }),
        },
        {
            label: "Date range",
            // A timespan that isn't a year range prints as authored
            value:
                makeDateRange({ dateRange: metadata.timespan }) ??
                metadata.timespan,
        },
        {
            label: "Last updated",
            value: makeLastUpdated({ lastUpdated }),
        },
        {
            label: "Next expected update",
            value: makeNextUpdate({ nextUpdate }),
        },
    ].filter((row) => !!row.value)
}
