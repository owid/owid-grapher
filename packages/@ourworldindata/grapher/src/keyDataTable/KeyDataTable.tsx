import React from "react"
import cx from "classnames"
import { OwidProcessingLevel } from "@ourworldindata/utils"
import {
    makeSource,
    makeLastUpdated,
    makeNextUpdate,
    makeDateRange,
    makeUnit,
    makeUnitConversionFactor,
    makeLinks,
} from "@ourworldindata/components"

interface KeyDataTableProps {
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

export const KeyDataTable = (props: KeyDataTableProps) => {
    const source = makeSource(props)
    const lastUpdated = makeLastUpdated(props)
    const nextUpdate = makeNextUpdate(props)
    const dateRange = makeDateRange(props)
    const unit = makeUnit(props)
    const unitConversionFactor = makeUnitConversionFactor(props)
    const links = makeLinks(props)

    return (
        <div
            className={cx("key-data-table", {
                "key-data-table--top-border": !props.hideTopBorder,
                "key-data-table--bottom-border": !props.hideBottomBorder,
            })}
        >
            {source && (
                <div className="key-data-table-item key-data-table-source key-data-table-item--span">
                    <div className="key-data-table-item__title">Source</div>
                    <div className="key-data-table-item__content">{source}</div>
                </div>
            )}
            {lastUpdated && (
                <div
                    className={cx("key-data-table-item", {
                        "key-data-table-item--span":
                            !nextUpdate &&
                            !dateRange &&
                            !unit &&
                            !unitConversionFactor,
                    })}
                >
                    <div className="key-data-table-item__title">
                        Last updated
                    </div>
                    <div className="key-data-table-item__content">
                        {lastUpdated}
                    </div>
                </div>
            )}
            {nextUpdate && (
                <div
                    className={cx("key-data-table-item", {
                        "key-data-table-item--span":
                            !dateRange &&
                            !lastUpdated &&
                            !unit &&
                            !unitConversionFactor,
                    })}
                >
                    <div className="key-data-table-item__title">
                        Next expected update
                    </div>
                    <div className="key-data-table-item__content">
                        {nextUpdate}
                    </div>
                </div>
            )}
            {dateRange && (
                <div
                    className={cx("key-data-table-item", {
                        "key-data-table-item--span":
                            !unit &&
                            !unitConversionFactor &&
                            isEven(count(lastUpdated, nextUpdate)),
                    })}
                >
                    <div className="key-data-table-item__title">Date range</div>
                    <div className="key-data-table-item__content">
                        {dateRange}
                    </div>
                </div>
            )}
            {unit && (
                <div
                    className={cx("key-data-table-item", {
                        "key-data-table-item--span":
                            !unitConversionFactor &&
                            isEven(count(lastUpdated, nextUpdate, dateRange)),
                    })}
                >
                    <div className="key-data-table-item__title">Unit</div>
                    <div className="key-data-table-item__content">{unit}</div>
                </div>
            )}
            {unitConversionFactor && (
                <div
                    className={cx("key-data-table-item", {
                        "key-data-table-item--span": isEven(
                            count(lastUpdated, nextUpdate, dateRange, unit)
                        ),
                    })}
                >
                    <div className="key-data-table-item__title">
                        Unit conversion factor
                    </div>
                    <div className="key-data-table-item__content">
                        {unitConversionFactor}
                    </div>
                </div>
            )}
            {links && (
                <div className="key-data-table-item key-data-table-item--span">
                    <div className="key-data-table-item__title">Links</div>
                    <div className="key-data-table-item__content">{links}</div>
                </div>
            )}
        </div>
    )
}

const count = (...args: any[]) => args.filter((arg) => arg).length
const isEven = (n: number) => n % 2 === 0
