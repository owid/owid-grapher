import React from "react"
import cx from "classnames"
import { OwidProcessingLevel, chunk, excludeNull } from "@ourworldindata/utils"
import {
    makeSource,
    makeLastUpdated,
    makeNextUpdate,
    makeDateRange,
    makeUnit,
    makeUnitConversionFactor,
    makeLinks,
} from "@ourworldindata/components"

interface SourcesKeyDataTableProps {
    attribution?: string
    dateRange?: string
    lastUpdated?: string
    nextUpdate?: string
    unit?: string
    owidProcessingLevel?: OwidProcessingLevel
    link?: string
    unitConversionFactor?: number
    isEmbeddedInADataPage?: boolean // true by default
}

export const SourcesKeyDataTable = (props: SourcesKeyDataTableProps) => {
    const source = makeSource(props)
    const lastUpdated = makeLastUpdated(props)
    const nextUpdate = makeNextUpdate(props)
    const dateRange = makeDateRange(props)
    const unit = makeUnit(props)
    const unitConversionFactor = makeUnitConversionFactor(props)
    const links = makeLinks(props)

    const keyDataWithoutSource = excludeNull([
        lastUpdated ? { label: "Last updated", content: lastUpdated } : null,
        nextUpdate
            ? { label: "Next expected update", content: nextUpdate }
            : null,
        dateRange ? { label: "Date range", content: dateRange } : null,
        unit ? { label: "Unit", content: unit } : null,
        unitConversionFactor
            ? {
                  label: "Unit conversion factor",
                  content: unitConversionFactor,
              }
            : null,
        links ? { label: "Links", content: links } : null,
    ])

    const rows = chunk(keyDataWithoutSource, 2)

    return (
        <div className="sources-key-data-table">
            {source && (
                <div className="key-data key-data--span">
                    <div className="key-data__title">Source</div>
                    <div className="key-data__content">{source}</div>
                </div>
            )}
            {rows.map(([first, second]) => (
                <React.Fragment key={first.label}>
                    <div
                        className={cx("key-data", {
                            "key-data--span": !second,
                        })}
                    >
                        <div className="key-data__title">{first.label}</div>
                        <div className="key-data__content">{first.content}</div>
                    </div>
                    {second && (
                        <div className="key-data">
                            <div className="key-data__title">
                                {second.label}
                            </div>
                            <div className="key-data__content">
                                {second.content}
                            </div>
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}
