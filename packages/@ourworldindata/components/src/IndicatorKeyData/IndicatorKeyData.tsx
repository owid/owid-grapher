import React from "react"
import cx from "classnames"
import {
    dayjs,
    OwidProcessingLevel,
    getPhraseForProcessingLevel,
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
    links?: string[]
    isEmbeddedInADataPage?: boolean // true by default
}

export const IndicatorKeyData = (props: IndicatorKeyDataProps) => {
    const isEmbeddedInADataPage = props.isEmbeddedInADataPage ?? true
    const processingLevelPhrase = getPhraseForProcessingLevel(
        props.owidProcessingLevel
    )
    const lastUpdated = dayjs(props.lastUpdated, ["YYYY", "YYYY-MM-DD"])
    return (
        <div className="indicator-key-data">
            {props.attribution && (
                <div className="indicator-key-data-item indicator-key-data-item--span">
                    <div className="indicator-key-data-item__title">Source</div>
                    <div className="indicator-key-data-item__content">
                        <SimpleMarkdownText text={props.attribution} />
                        {" - "}
                        {isEmbeddedInADataPage ? (
                            <a
                                href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                            >
                                {processingLevelPhrase}
                            </a>
                        ) : (
                            processingLevelPhrase
                        )}
                    </div>
                </div>
            )}
            {props.lastUpdated && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !props.nextUpdate &&
                            !props.dateRange &&
                            !props.unit,
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Last updated
                    </div>
                    <div className="indicator-key-data-item__content">
                        {lastUpdated.format("MMMM D, YYYY")}
                    </div>
                </div>
            )}
            {props.nextUpdate && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !props.dateRange &&
                            !props.unit &&
                            !props.lastUpdated,
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Next expected update
                    </div>
                    <div className="indicator-key-data-item__content">
                        {props.nextUpdate}
                    </div>
                </div>
            )}
            {props.dateRange && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span":
                            !props.unit &&
                            isEven(count(props.lastUpdated, props.nextUpdate)),
                    })}
                >
                    <div className="indicator-key-data-item__title">
                        Date range
                    </div>
                    <div className="indicator-key-data-item__content">
                        {getDateRange(props.dateRange)}
                    </div>
                </div>
            )}
            {props.unit && (
                <div
                    className={cx("indicator-key-data-item", {
                        "indicator-key-data-item--span": isEven(
                            count(
                                props.lastUpdated,
                                props.nextUpdate,
                                props.dateRange
                            )
                        ),
                    })}
                >
                    <div className="indicator-key-data-item__title">Unit</div>
                    <div className="indicator-key-data-item__content">
                        {props.unit}
                    </div>
                </div>
            )}
            {props.links && props.links.length > 0 && (
                <div className="indicator-key-data-item indicator-key-data-item--span">
                    <div className="indicator-key-data-item__title">
                        {props.links.length > 1 ? "Links" : "Link"}
                    </div>
                    <div className="indicator-key-data-item__content">
                        {props.links.map((link, index, links) => (
                            <>
                                <a
                                    href={link}
                                    target="_blank"
                                    rel="nopener noreferrer"
                                >
                                    {link}
                                </a>
                                {index < links.length - 1 && <br />}
                            </>
                        ))}
                    </div>
                </div>
            )}
        </div>
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
