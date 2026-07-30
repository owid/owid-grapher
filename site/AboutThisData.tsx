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
import {
    countDescriptionKeyBullets,
    getAttributionUnshortened,
} from "./datapageUtils.js"

// The number of descriptionKey bullets from which the description column of
// the "What you should know about this indicator" section outgrows the metadata
// column beside it. Measured across every data page that renders the section,
// counting bullets with countDescriptionKeyBullets() below, then scoring each
// candidate cut by whether the newsletter card ends up in the column that
// actually measured shorter: a cut at five places the card correctly on 90.0%
// of the 1,633 two-column pages against 86.5% at six, and leaves roughly half
// as much blank space standing. Five-bullet pages are 77% description-taller,
// so they belong above the cut; four-bullet pages are 47%, a coin flip, so they
// stay below. The sweep this comes from, and the script that reproduces it, are
// in devTools/datapageColumnHeights.
const LEFT_COLUMN_TALLER_BULLET_COUNT = 5

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

    // The newsletter card goes in whichever of the two columns is the shorter
    // one, so that it fills space that would otherwise be blank.
    const isNewsletterCardOnLeft =
        (datapageData.descriptionKey
            ? countDescriptionKeyBullets(datapageData.descriptionKey)
            : 0) < LEFT_COLUMN_TALLER_BULLET_COUNT

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
                        {isNewsletterCardOnLeft && (
                            /* Inside the description column rather than as a
                               grid item of its own: a third row would sit below
                               the taller of the two columns, which is the space
                               we're trying to fill. */
                            <TopicNewsletterCard
                                pageType="chart"
                                topicArea={topicArea}
                                className="topic-newsletter-card--key-info-left"
                            />
                        )}
                    </div>
                    <div className="key-info__right span-cols-4 span-lg-cols-5 span-sm-cols-12">
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attributionUnshortened}
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
                            // The card takes the last three columns beside the
                            // metadata, so the metadata has to stop three
                            // columns short of the section's right edge — but
                            // only when there is a card to make room for. With
                            // no topic area the card renders nothing and the
                            // metadata keeps the full width it has always had.
                            {
                                "about-this-data__key-data--with-newsletter-card":
                                    !!topicArea,
                            }
                        )}
                    >
                        <KeyDataTable
                            datapageData={datapageData}
                            attribution={attributionUnshortened}
                        />
                    </div>
                    {/* Right rail beside the metadata fields at md-up, level
                        with them and filling the space their short values leave
                        blank; full width below the key data table below that. */}
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
