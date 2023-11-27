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

    return (
        <div
            className={cx("sources-key-data-table", {
                "sources-key-data-table--top-border": !props.hideTopBorder,
                "sources-key-data-table--bottom-border":
                    !props.hideBottomBorder,
            })}
        >
            {source && (
                <div className="key-data key-data-source key-data--span">
                    <div className="key-data__title">Source</div>
                    <div className="key-data__content">{source}</div>
                </div>
            )}
            {lastUpdated && (
                <div
                    className={cx("key-data", {
                        "key-data--span":
                            !nextUpdate &&
                            !dateRange &&
                            !unit &&
                            !unitConversionFactor,
                    })}
                >
                    <div className="key-data__title">Last updated</div>
                    <div className="key-data__content">{lastUpdated}</div>
                </div>
            )}
            {nextUpdate && (
                <div
                    className={cx("key-data", {
                        "key-data--span":
                            !dateRange &&
                            !lastUpdated &&
                            !unit &&
                            !unitConversionFactor,
                    })}
                >
                    <div className="key-data__title">Next expected update</div>
                    <div className="key-data__content">{nextUpdate}</div>
                </div>
            )}
            {dateRange && (
                <div
                    className={cx("key-data", {
                        "key-data--span":
                            !unit &&
                            !unitConversionFactor &&
                            isEven(count(lastUpdated, nextUpdate)),
                    })}
                >
                    <div className="key-data__title">Date range</div>
                    <div className="key-data__content">{dateRange}</div>
                </div>
            )}
            {unit && (
                <div
                    className={cx("key-data", {
                        "key-data--span":
                            !unitConversionFactor &&
                            isEven(count(lastUpdated, nextUpdate, dateRange)),
                    })}
                >
                    <div className="key-data__title">Unit</div>
                    <div className="key-data__content">{unit}</div>
                </div>
            )}
            {unitConversionFactor && (
                <div
                    className={cx("key-data", {
                        "key-data--span": isEven(
                            count(lastUpdated, nextUpdate, dateRange, unit)
                        ),
                    })}
                >
                    <div className="key-data__title">
                        Unit conversion factor
                    </div>
                    <div className="key-data__content">
                        {unitConversionFactor}
                    </div>
                </div>
            )}
            {links && (
                <div className="key-data key-data--span">
                    <div className="key-data__title">Links</div>
                    <div className="key-data__content">{links}</div>
                </div>
            )}
        </div>
    )
}

const count = (...args: any[]) => args.filter((arg) => arg).length
const isEven = (n: number) => n % 2 === 0
