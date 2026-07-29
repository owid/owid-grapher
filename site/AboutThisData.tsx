import * as _ from "lodash-es"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons"

import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    SimpleMarkdownText,
    ExpandableToggle,
    HtmlOrSimpleMarkdownText,
} from "@ourworldindata/components"
import { DataPageDataV2 } from "@ourworldindata/types"
import KeyDataTable from "./KeyDataTable.js"
import TopicNewsletterCard from "./TopicNewsletterCard.js"
import { getAttributionUnshortened } from "./datapageUtils.js"

export default function AboutThisData({
    datapageData,
    hasFaq,
    className,
    id,
    topicArea,
}: {
    datapageData: DataPageDataV2
    hasFaq: boolean
    className?: string
    id?: string
    // Passed separately rather than read off datapageData because multi-dim
    // pages rebuild datapageData client-side on every view switch, which would
    // drop it.
    topicArea?: string
}) {
    const hasDescriptionKey = !!datapageData.descriptionKey
    const attributionUnshortened = getAttributionUnshortened(datapageData)
    const id_ = id ?? DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
    const hasKeyInfo =
        hasDescriptionKey ||
        !!datapageData.descriptionFromProducer ||
        !!datapageData.source?.additionalInfo

    return (
        <div
            className={cx(
                "wrapper-about-this-data grid grid-cols-12",
                // Without key information the heading and the newsletter card
                // share a narrow label column, which needs its own grid rows.
                { "wrapper-about-this-data--label-column": !hasKeyInfo },
                className
            )}
        >
            {hasKeyInfo ? (
                <>
                    <h2 id={id_} className="key-info__title span-cols-12">
                        What you should know about this indicator
                    </h2>
                    <div className="col-start-1 span-cols-8 span-lg-cols-7 span-sm-cols-12">
                        <div className="key-info__content">
                            {datapageData.descriptionKey && (
                                <div className="key-info__key-description">
                                    <SimpleMarkdownText
                                        text={datapageData.descriptionKey.trim()}
                                    />
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
                        {/* Inside the metadata column, below the key data
                            table, so that it sits in the column that is usually
                            the shorter of the two. */}
                        <TopicNewsletterCard
                            pageType="chart"
                            topicArea={topicArea}
                            variant="narrow"
                            className="topic-newsletter-card--key-info"
                        />
                    </div>
                </>
            ) : (
                <>
                    <h2
                        className="about-this-data__title span-cols-3 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                        id={id_}
                    >
                        About this data
                    </h2>
                    <div className="about-this-data__key-data col-start-4 span-cols-10 col-lg-start-5 span-lg-cols-8 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attributionUnshortened}
                        />
                    </div>
                    {/* In the label column directly below the heading at md-up
                        (the rows that put it there live in AboutThisData.scss),
                        full width below the key data table below that. */}
                    <TopicNewsletterCard
                        pageType="chart"
                        topicArea={topicArea}
                        variant="narrow"
                        className="topic-newsletter-card--about-this-data col-start-1 span-cols-3 col-lg-start-1 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                    />
                </>
            )}
        </div>
    )
}
