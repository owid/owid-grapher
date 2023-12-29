import React from "react"
import {
    OwidProcessingLevel,
    getPhraseForProcessingLevel,
    splitSourceTextIntoFragments,
    formatSourceDate,
} from "@ourworldindata/utils"
import { DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID } from "../SharedDataPageConstants.js"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

export const makeSource = ({
    attribution,
    owidProcessingLevel,
    isEmbeddedInADataPage,
}: {
    attribution?: string
    owidProcessingLevel?: OwidProcessingLevel
    isEmbeddedInADataPage?: boolean
}): React.ReactNode => {
    if (!attribution) return null
    const isEmbedded = isEmbeddedInADataPage ?? true
    const processingLevelPhrase =
        getPhraseForProcessingLevel(owidProcessingLevel)
    const hideProcessingPhase =
        attribution.toLowerCase() === "our world in data"
    return (
        <>
            <SimpleMarkdownText text={attribution} useParagraphs={false} />
            {!hideProcessingPhase && (
                <>
                    {" – "}
                    {isEmbedded ? (
                        <a
                            href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                        >
                            {processingLevelPhrase}
                        </a>
                    ) : (
                        processingLevelPhrase
                    )}{" "}
                    by Our World in Data
                </>
            )}
        </>
    )
}

export const makeLastUpdated = ({
    lastUpdated,
}: {
    lastUpdated?: string
}): React.ReactNode => {
    return formatSourceDate(lastUpdated, "MMMM D, YYYY")
}

export const makeNextUpdate = ({
    nextUpdate,
}: {
    nextUpdate?: string
}): React.ReactNode => {
    return formatSourceDate(nextUpdate, "MMMM YYYY")
}

export const makeDateRange = ({
    dateRange,
}: {
    dateRange?: string
}): React.ReactNode => {
    if (!dateRange) return null
    return getDateRange(dateRange)
}

export const makeUnit = ({ unit }: { unit?: string }): React.ReactNode => {
    if (!unit) return null
    return unit
}

export const makeUnitConversionFactor = ({
    unitConversionFactor,
}: {
    unitConversionFactor?: number
}): React.ReactNode => {
    if (!unitConversionFactor || unitConversionFactor === 1) return null
    return unitConversionFactor
}

export const makeLinks = ({ link }: { link?: string }): React.ReactNode => {
    if (!link) return null
    const linkFragments = splitSourceTextIntoFragments(link)
    return linkFragments.map((urlOrText, index) => {
        const isUrl = urlOrText.startsWith("http") && !urlOrText.match(/\s/)
        return (
            <React.Fragment key={urlOrText}>
                <span>
                    {isUrl ? (
                        <a
                            href={urlOrText}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {urlOrText}
                        </a>
                    ) : (
                        <SimpleMarkdownText
                            text={urlOrText}
                            useParagraphs={false}
                        />
                    )}
                </span>
                {index < linkFragments.length - 1 && <br />}
            </React.Fragment>
        )
    })
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
