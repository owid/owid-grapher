import React from "react"
import {
    OwidProcessingLevel,
    getPhraseForProcessingLevel,
    splitSourceTextIntoFragments,
    formatSourceDate,
    getDateRange,
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
                        <a href={urlOrText} target="_blank" rel="noopener">
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
