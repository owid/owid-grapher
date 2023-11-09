import React from "react"
import cx from "classnames"
import { OwidProcessingLevel, excludeNull, range } from "@ourworldindata/utils"
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

    // styling
    hideTopBorder?: boolean
    hideBottomBorder?: boolean
}

export const SourcesKeyDataTable = (props: SourcesKeyDataTableProps) => {
    const source = makeSource(props)
    const lastUpdated = makeLastUpdated(props)
    const nextUpdate = makeNextUpdate(props)
    const dateRange = makeDateRange(props)
    const unit = makeUnit(props)
    const unitConversionFactor = makeUnitConversionFactor(props)
    const links = makeLinks(props)

    const keyData = excludeNull([
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
    ])

    const rows = range(0, keyData.length, 2).map((index: number) => [
        keyData[index],
        keyData[index + 1],
    ])

    const hasSingleRow =
        ((source || links) && rows.length === 0) ||
        (!source && !links && rows.length === 1)

    return (
        <div
            className={cx("sources-key-data-table", {
                "sources-key-data-table--hide-top-border":
                    hasSingleRow || props.hideTopBorder,
                "sources-key-data-table--hide-bottom-border":
                    hasSingleRow || props.hideBottomBorder,
            })}
        >
            {source && (
                <div className="row">
                    <div className="key-data key-data--span">
                        <div className="key-data__title">Source</div>
                        <div className="key-data__content">{source}</div>
                    </div>
                </div>
            )}
            {rows.map(([first, second]) => (
                <div key={first.label} className="row">
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
                </div>
            ))}
            {links && (
                <div className="row">
                    <div className="key-data key-data--span">
                        <div className="key-data__title">Links</div>
                        <div className="key-data__content">{links}</div>
                    </div>
                </div>
            )}
        </div>
    )
}
