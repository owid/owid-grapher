import React from "react"
import cx from "classnames"
import {
    dayjs,
    OwidProcessingLevel,
    getPhraseForProcessingLevel,
    splitSourceTextIntoFragments,
} from "@ourworldindata/utils"
import { DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID } from "../SharedDataPageConstants.js"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

interface IndicatorKeyDataProps {
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

export const IndicatorKeyData = (props: IndicatorKeyDataProps) => {
    const source = makeKeyDataSource(props)
    const lastUpdated = makeKeyDataLastUpdated(props)
    const nextUpdate = makeKeyDataNextUpdate(props)
    const dateRange = makeKeyDataDateRange(props)
    const unit = makeKeyDataUnit(props)
    const unitConversionFactor = makeKeyDataUnitConversionFactor(props)
    const links = makeKeyDataLinks(props)

    const keyDataCount = count(
        source,
        lastUpdated,
        nextUpdate,
        dateRange,
        unit,
        unitConversionFactor,
        links
    )
    const hasSingleRow =
        keyDataCount === 1 || (keyDataCount === 2 && !source && !links)

    return (
        <div
            className={cx("indicator-key-data", {
                "indicator-key-data--top-border":
                    !hasSingleRow && !props.hideTopBorder,
                "indicator-key-data--bottom-border":
                    !hasSingleRow && !props.hideBottomBorder,
            })}
        >
            {source && (
                <div className="indicator-key-data-item indicator-key-data-item--span">
                    <div className="indicator-key-data-item__title">Source</div>
                    <div className="indicator-key-data-item__content">
                        {source}
                    </div>
                </div>
            )}
            {lastUpdated && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !nextUpdate &&
                            !dateRange &&
                            !unit &&
                            !unitConversionFactor,
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Last updated
                    </div>
                    <div className="indicator-key-data-item__content">
                        {lastUpdated}
                    </div>
                </div>
            )}
            {nextUpdate && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !dateRange &&
                            !lastUpdated &&
                            !unit &&
                            !unitConversionFactor,
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Next expected update
                    </div>
                    <div className="indicator-key-data-item__content">
                        {nextUpdate}
                    </div>
                </div>
            )}
            {dateRange && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !unit &&
                            !unitConversionFactor &&
                            isEven(count(lastUpdated, nextUpdate)),
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Date range
                    </div>
                    <div className="indicator-key-data-item__content">
                        {dateRange}
                    </div>
                </div>
            )}
            {unit && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !unitConversionFactor &&
                            isEven(count(lastUpdated, nextUpdate, dateRange)),
                    })}
                >
                    <div className="indicator-key-data-item__title">Unit</div>
                    <div className="indicator-key-data-item__content">
                        {unit}
                    </div>
                </div>
            )}
            {unitConversionFactor && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span": isEven(
                            count(lastUpdated, nextUpdate, dateRange, unit)
                        ),
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Unit conversion factor
                    </div>
                    <div className="indicator-key-data-item__content">
                        {unitConversionFactor}
                    </div>
                </div>
            )}
            {links && (
                <div className="indicator-key-data-item indicator-key-data-item--span">
                    <div className="indicator-key-data-item__title">Links</div>
                    <div className="indicator-key-data-item__content">
                        {links}
                    </div>
                </div>
            )}
        </div>
    )
}

export const makeKeyDataSource = ({
    attribution,
    owidProcessingLevel,
    isEmbeddedInADataPage,
}: Pick<
    IndicatorKeyDataProps,
    "attribution" | "owidProcessingLevel" | "isEmbeddedInADataPage"
>): React.ReactNode => {
    if (!attribution) return null
    const isEmbedded = isEmbeddedInADataPage ?? true
    const processingLevelPhrase =
        getPhraseForProcessingLevel(owidProcessingLevel)
    return (
        <>
            <SimpleMarkdownText text={attribution} useParagraphs={false} />
            {" - "}
            {isEmbedded ? (
                <a href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}>
                    {processingLevelPhrase}
                </a>
            ) : (
                processingLevelPhrase
            )}{" "}
            by Our World in Data
        </>
    )
}

export const makeKeyDataLastUpdated = ({
    lastUpdated,
}: Pick<IndicatorKeyDataProps, "lastUpdated">): React.ReactNode => {
    const date = dayjs(lastUpdated ?? "", ["YYYY-MM-DD", "YYYY"])
    if (!date.isValid()) return null
    return date.format("MMMM D, YYYY")
}

export const makeKeyDataNextUpdate = ({
    nextUpdate,
}: Pick<IndicatorKeyDataProps, "nextUpdate">): React.ReactNode => {
    const date = dayjs(nextUpdate ?? "", ["YYYY-MM-DD"])
    if (!date.isValid()) return null
    return date.format("MMMM YYYY")
}

export const makeKeyDataDateRange = ({
    dateRange,
}: Pick<IndicatorKeyDataProps, "dateRange">): React.ReactNode => {
    if (!dateRange) return null
    return getDateRange(dateRange)
}

export const makeKeyDataUnit = ({
    unit,
}: Pick<IndicatorKeyDataProps, "unit">): React.ReactNode => {
    if (!unit) return null
    return unit
}

export const makeKeyDataUnitConversionFactor = ({
    unitConversionFactor,
}: Pick<IndicatorKeyDataProps, "unitConversionFactor">): React.ReactNode => {
    if (!unitConversionFactor || unitConversionFactor === 1) return null
    return unitConversionFactor
}

export const makeKeyDataLinks = ({
    link,
}: Pick<IndicatorKeyDataProps, "link">): React.ReactNode => {
    if (!link) return null
    const linkFragments = splitSourceTextIntoFragments(link)
    return (
        <>
            {linkFragments.map((text, index) => (
                <>
                    <span>
                        <SimpleMarkdownText text={text} useParagraphs={false} />
                    </span>
                    {index < linkFragments.length - 1 && <br />}
                </>
            ))}
        </>
    )
}

const getDateRange = (dateRange: string): string | null => {
    // This regex matches:
    //   Beginning of string
    //   Ignore whitespace
    //   a named group called start that matches:
    //     hyphen aka minus
    //     1 or more digits
    //   Ignore whitespace
    //   hyphen aka minus OR en dash
    //   Ignore whitespace
    //   a named group called end that matches:
    //     hyphen aka minus
    //     1 or more digits
    //   Ignore whitespace
    //   End of string
    const dateRangeRegex = /^\s*(?<start>(-)?\d+)\s*(-|–)\s*(?<end>(-)?\d+)\s*$/
    const match = dateRange.match(dateRangeRegex)
    if (match) {
        const firstYearString = match.groups?.start
        const lastYearString = match.groups?.end
        if (!firstYearString || !lastYearString) return null

        const firstYear = parseInt(firstYearString, 10)
        const lastYear = parseInt(lastYearString, 10)
        let formattedFirstYear

        // if start year is before year 0, add BCE to the end
        if (firstYear < 0) formattedFirstYear = `${Math.abs(firstYear)} BCE`
        else formattedFirstYear = firstYear

        // if end year is before year 0, add BCE to the end or, if start year is after year 0, add CE to the end
        let formattedLastYear
        if (lastYear < 0) formattedLastYear = `${Math.abs(lastYear)} BCE`
        else if (firstYear < 0) formattedLastYear = `${lastYear} CE`
        else formattedLastYear = lastYear

        if (lastYear < 0 || firstYear < 0)
            return `${formattedFirstYear} – ${formattedLastYear}`
        else return `${formattedFirstYear}–${formattedLastYear}`
    }
    return null
}

const count = (...args: any[]) => args.filter((arg) => arg).length
const isEven = (n: number) => n % 2 === 0
