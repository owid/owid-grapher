import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons"
import dayjs from "dayjs"

import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    SimpleMarkdownText,
    ExpandableToggle,
    HtmlOrSimpleMarkdownText,
} from "@ourworldindata/components"
import { DataPageDataV2, OwidOrigin } from "@ourworldindata/types"
import { uniq } from "@ourworldindata/utils"
import KeyDataTable from "./KeyDataTable.js"

function getYearSuffixFromOrigin(origin: OwidOrigin) {
    const year = origin.dateAccessed
        ? dayjs(origin.dateAccessed, ["YYYY-MM-DD", "YYYY"]).year()
        : origin.datePublished
          ? dayjs(origin.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
          : undefined
    if (year) return ` (${year})`
    else return ""
}

export default function AboutThisData({
    datapageData,
    hasFaq,
}: {
    datapageData: DataPageDataV2
    hasFaq: boolean
}) {
    const hasDescriptionKey =
        datapageData.descriptionKey && datapageData.descriptionKey.length > 0
    const producersWithYear = uniq(
        datapageData.origins.map(
            (o) => `${o.producer}${getYearSuffixFromOrigin(o)}`
        )
    )
    const attributionFragments = datapageData.attributions ?? producersWithYear
    const attributionUnshortened = attributionFragments.join("; ")

    return (
        <div className="wrapper-about-this-data grid grid-cols-12">
            {hasDescriptionKey ||
            datapageData.descriptionFromProducer ||
            datapageData.source?.additionalInfo ? (
                <>
                    <h2
                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                        className="key-info__title span-cols-12"
                    >
                        What you should know about this indicator
                    </h2>
                    <div className="col-start-1 span-cols-8 span-lg-cols-7 span-sm-cols-12">
                        <div className="key-info__content">
                            {hasDescriptionKey && (
                                <div className="key-info__key-description">
                                    {datapageData.descriptionKey.length ===
                                    1 ? (
                                        <SimpleMarkdownText
                                            text={datapageData.descriptionKey[0].trim()}
                                        />
                                    ) : (
                                        <ul>
                                            {datapageData.descriptionKey.map(
                                                (text, i) => (
                                                    <li key={i}>
                                                        <SimpleMarkdownText
                                                            text={text.trim()}
                                                            useParagraphs={
                                                                false
                                                            }
                                                        />
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    )}
                                    {hasFaq && (
                                        <a
                                            className="key-info__learn-more"
                                            href="#faqs"
                                        >
                                            Learn more in the FAQs
                                            <FontAwesomeIcon
                                                icon={faArrowDown}
                                            />
                                        </a>
                                    )}
                                </div>
                            )}

                            <div className="key-info__expandable-descriptions">
                                {datapageData.descriptionFromProducer && (
                                    <ExpandableToggle
                                        label={
                                            datapageData.attributionShort
                                                ? `How is this data described by its producer - ${datapageData.attributionShort}?`
                                                : "How is this data described by its producer?"
                                        }
                                        content={
                                            <div className="article-block__text">
                                                <SimpleMarkdownText
                                                    text={
                                                        datapageData.descriptionFromProducer
                                                    }
                                                />
                                            </div>
                                        }
                                        isStacked={
                                            !!datapageData.source
                                                ?.additionalInfo
                                        }
                                    />
                                )}
                                {datapageData.source?.additionalInfo && (
                                    <ExpandableToggle
                                        label="Additional information about this data"
                                        content={
                                            <div className="expandable-info-blocks__content">
                                                <HtmlOrSimpleMarkdownText
                                                    text={datapageData.source?.additionalInfo.trim()}
                                                />
                                            </div>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="key-info__right span-cols-4 span-lg-cols-5 span-sm-cols-12">
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attributionUnshortened}
                        />
                    </div>
                </>
            ) : (
                <>
                    <h2
                        className="about-this-data__title span-cols-3 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                    >
                        About this data
                    </h2>
                    <div className="col-start-4 span-cols-10 col-lg-start-5 span-lg-cols-8 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attributionUnshortened}
                        />
                    </div>
                </>
            )}
        </div>
    )
}
