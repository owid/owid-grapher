import * as _ from "lodash-es"
import cx from "clsx"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons"

import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    SimpleMarkdownText,
    ExpandableToggle,
    HtmlOrSimpleMarkdownText,
    Button,
} from "@ourworldindata/components"
import { DataPageDataV2 } from "@ourworldindata/types"
import { formatAttributions } from "@ourworldindata/utils"
import KeyDataTable from "./KeyDataTable.js"
import TopicNewsletterCard from "./TopicNewsletterCard.js"
import { hasTopicNewsletterCard } from "./topicNewsletter.js"
import { isDescriptionColumnShorter } from "./datapageUtils.js"

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
    topicArea?: string
}) {
    const hasDescriptionKey = !!datapageData.descriptionKey
    const attribution = formatAttributions(datapageData.attributions ?? [])
    const id_ = id ?? DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
    const hasKeyInfo =
        hasDescriptionKey ||
        !!datapageData.descriptionFromProducer ||
        !!datapageData.source?.additionalInfo
    const isNewsletterCardOnLeft = isDescriptionColumnShorter(
        datapageData.descriptionKey
    )

    return (
        <div
            className={cx(
                "wrapper-about-this-data grid grid-cols-12",
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
                        {hasDescriptionKey && hasFaq && (
                            <Button
                                className="key-info__learn-more"
                                theme="solid-light-blue"
                                text="Learn more in the FAQs"
                                href="#faqs"
                                icon={faArrowDown}
                            />
                        )}
                        {isNewsletterCardOnLeft && (
                            <TopicNewsletterCard
                                pageType="chart"
                                topicArea={topicArea}
                                className="topic-newsletter-card--key-info-left topic-newsletter-card--horizontal"
                            />
                        )}
                    </div>
                    <div className="key-info__right span-cols-4 span-lg-cols-5 span-sm-cols-12">
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attribution}
                        />
                        {!isNewsletterCardOnLeft && (
                            <TopicNewsletterCard
                                pageType="chart"
                                topicArea={topicArea}
                                variant="narrow"
                                className="topic-newsletter-card--key-info"
                            />
                        )}
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
                    <div
                        className={cx(
                            "about-this-data__key-data col-start-4 span-cols-10 col-lg-start-5 span-lg-cols-8 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12",
                            // Make room for the card only when there is one.
                            {
                                "about-this-data__key-data--with-newsletter-card":
                                    hasTopicNewsletterCard(topicArea),
                            }
                        )}
                    >
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attribution}
                        />
                    </div>
                    <TopicNewsletterCard
                        pageType="chart"
                        topicArea={topicArea}
                        variant="narrow"
                        className="topic-newsletter-card--about-this-data col-start-10 span-cols-3 col-lg-start-10 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                    />
                </>
            )}
        </div>
    )
}
