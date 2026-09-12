import { BespokeMetadata } from "@ourworldindata/types"
import {
    MetadataBoxKeyData,
    MetadataBoxKeyDataRow,
} from "../MetadataBox/MetadataBoxKeyData.js"
import { getBespokeKeyDataRows } from "./bespokeKeyDataRows.js"

export function BespokeMetadataKeyData({
    metadata,
}: {
    metadata: BespokeMetadata
}): React.ReactElement | null {
    const rows = getBespokeKeyDataRows(metadata)

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
