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
import { getAttributionUnshortened } from "./datapageUtils.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import TrackedProseLinks from "./TrackedProseLinks.js"

const analytics = new SiteAnalytics()

// Emits the same events, under the same target names, as the treatment arm's
// IndicatorMetadataBox, so the control arm has a comparable baseline. `target`
// is a codified identifier rather than the rendered label, so the event survives
// page translation.
function logExpandableToggle(target: string, isOpen: boolean): void {
    analytics.logSiteClick(
        isOpen ? "expand_expandable_toggle" : "collapse_expandable_toggle",
        target
    )
}

export default function AboutThisData({
    datapageData,
    hasFaq,
    className,
    id,
}: {
    datapageData: DataPageDataV2
    hasFaq: boolean
    className?: string
    id?: string
}) {
    const hasDescriptionKey = !!datapageData.descriptionKey
    const attributionUnshortened = getAttributionUnshortened(datapageData)
    const id_ = id ?? DATAPAGE_ABOUT_THIS_DATA_SECTION_ID

    return (
        <div
            className={cx(
                "wrapper-about-this-data grid grid-cols-12",
                className
            )}
        >
            {hasDescriptionKey ||
            datapageData.descriptionFromProducer ||
            datapageData.source?.additionalInfo ? (
                <>
                    <h2 id={id_} className="key-info__title span-cols-12">
                        What you should know about this indicator
                    </h2>
                    <div className="col-start-1 span-cols-8 span-lg-cols-7 span-sm-cols-12">
                        <div className="key-info__content">
                            {datapageData.descriptionKey && (
                                <div className="key-info__key-description">
                                    <TrackedProseLinks note="wysk_link">
                                        <SimpleMarkdownText
                                            text={datapageData.descriptionKey.trim()}
                                        />
                                    </TrackedProseLinks>
                                    {hasFaq && (
                                        <a
                                            className="key-info__learn-more"
                                            href="#faqs"
                                            data-track-note="wysk_learn_more_in_faqs"
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
                                        onToggle={(isOpen) =>
                                            logExpandableToggle(
                                                "producer_documentation",
                                                isOpen
                                            )
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
                                        onToggle={(isOpen) =>
                                            // Control-only: the metadata box
                                            // drops this section, so it has no
                                            // treatment counterpart. Tracked to
                                            // show what control readers open
                                            // instead.
                                            logExpandableToggle(
                                                "additional_information",
                                                isOpen
                                            )
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
                        id={id_}
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
