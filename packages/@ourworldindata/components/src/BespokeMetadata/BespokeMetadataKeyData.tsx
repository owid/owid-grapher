import * as _ from "lodash-es"
import { BespokeMetadata } from "@ourworldindata/types"
import {
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getOriginAttributionFragments,
} from "@ourworldindata/utils"
import {
    makeDateRange,
    makeLastUpdated,
    makeNextUpdate,
    makeSource,
    makeUnit,
} from "../IndicatorKeyData/IndicatorKeyData.js"
import {
    MetadataBoxKeyData,
    MetadataBoxKeyDataRow,
} from "../MetadataBox/MetadataBoxKeyData.js"

interface BespokeMetadataKeyDataRow {
    label: string
    value: React.ReactNode
    isFullWidth?: boolean
    labelClassName?: string
}

export function BespokeMetadataKeyData({
    metadata,
}: {
    metadata: BespokeMetadata
}): React.ReactElement | null {
    const attributions = metadata.attribution
        ? [metadata.attribution]
        : _.uniq(getOriginAttributionFragments(metadata.origins))

    const lastUpdated = getLastUpdatedFromVariable(metadata)
    const nextUpdate = lastUpdated
        ? getNextUpdateFromVariable(metadata)
        : undefined

    const rows: BespokeMetadataKeyDataRow[] = [
        {
            label: "Data source",
            value: makeSource({
                attribution: attributions.join("; "),
                owidProcessingLevel: metadata.processingLevel,
                isEmbeddedInADataPage: false,
            }),
            isFullWidth: true,
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

    if (rows.length === 0) return null

    return (
        <MetadataBoxKeyData>
            {rows.map(({ label, value, isFullWidth, labelClassName }) => (
                <MetadataBoxKeyDataRow
                    key={label}
                    label={label}
                    isFullWidth={isFullWidth}
                    labelClassName={labelClassName}
                >
                    {value}
                </MetadataBoxKeyDataRow>
            ))}
        </MetadataBoxKeyData>
    )
}
