import * as React from "react"
import dayjs from "dayjs"

import {
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    IndicatorSources,
    IndicatorProcessing,
    CodeSnippet,
    DataCitation,
} from "@ourworldindata/components"
import {
    FaqEntryData,
    OwidOrigin,
    PrimaryTopic,
    OwidSource,
    IndicatorTitleWithFragments,
    OwidProcessingLevel,
} from "@ourworldindata/types"
import {
    prepareSourcesForDisplay,
    getCitationShort,
    getCitationLong,
    excludeUndefined,
    uniq,
} from "@ourworldindata/utils"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"

export default function MetadataSection({
    attributionShort,
    attributions,
    canonicalUrl,
    descriptionProcessing,
    faqEntries,
    origins,
    owidProcessingLevel,
    primaryTopic,
    source,
    title,
    titleVariant,
}: {
    attributionShort?: string
    attributions: string[]
    canonicalUrl: string
    descriptionProcessing?: string
    faqEntries?: FaqEntryData
    origins: OwidOrigin[]
    owidProcessingLevel?: OwidProcessingLevel
    primaryTopic?: PrimaryTopic
    source?: OwidSource
    title: IndicatorTitleWithFragments
    titleVariant?: string
}) {
    const sourcesForDisplay = prepareSourcesForDisplay({ origins, source })
    const citationShort = getCitationShort(
        origins,
        attributions,
        owidProcessingLevel
    )
    const citationLong = getCitationLong(
        title,
        origins,
        source,
        attributions,
        attributionShort,
        titleVariant,
        owidProcessingLevel,
        canonicalUrl
    )
    const currentYear = dayjs().year()
    const producers = uniq(origins.map((o) => `${o.producer}`))
    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : source?.name

    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`

    // For the citation of the data page add a period it doesn't have that or a question mark
    const primaryTopicCitation = maybeAddPeriod(primaryTopic?.citation ?? "")
    const citationDatapage = excludeUndefined([
        primaryTopic
            ? `“Data Page: ${title.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${title.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${canonicalUrl} [online resource]`,
    ]).join(" ")
    return (
        <div className="MetadataSection span-cols-14 grid grid-cols-12-full-width">
            <div className="col-start-2 span-cols-12">
                {!!faqEntries?.faqs.length && (
                    <div className="section-wrapper section-wrapper__faqs grid">
                        <h2
                            className="faqs__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                            id="faqs"
                        >
                            Frequently Asked Questions
                        </h2>
                        <div className="faqs__items grid grid-cols-10 grid-lg-cols-9 grid-md-cols-12 span-cols-10 span-lg-cols-9 span-md-cols-12 span-sm-cols-12">
                            <ArticleBlocks
                                blocks={faqEntries.faqs}
                                containerType="datapage"
                            />
                        </div>
                    </div>
                )}
                <div className="section-wrapper grid">
                    <h2
                        className="data-sources-processing__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                        id={DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}
                    >
                        Sources and processing
                    </h2>
                    <div className="data-sources grid span-cols-12">
                        <h3 className="data-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            This data is based on the following sources
                        </h3>
                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            <IndicatorSources sources={sourcesForDisplay} />
                        </div>
                    </div>
                    <div className="data-processing grid span-cols-12">
                        <h3 className="data-processing__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            How we process data at Our World in Data
                        </h3>
                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            <IndicatorProcessing
                                descriptionProcessing={descriptionProcessing}
                            />
                        </div>
                    </div>
                </div>
                <div className="section-wrapper grid">
                    <h2
                        className="reuse__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                        id="reuse-this-work"
                    >
                        Reuse this work
                    </h2>
                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                        <ul className="reuse__content">
                            <li className="reuse__list-item">
                                All data produced by third-party providers and
                                made available by Our World in Data are subject
                                to the license terms from the original
                                providers. Our work would not be possible
                                without the data providers we rely on, so we ask
                                you to always cite them appropriately (see
                                below). This is crucial to allow data providers
                                to continue doing their work, enhancing,
                                maintaining and updating valuable data.
                            </li>
                            <li className="reuse__list-item">
                                All data, visualizations, and code produced by
                                Our World in Data are completely open access
                                under the{" "}
                                <a
                                    href="https://creativecommons.org/licenses/by/4.0/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="reuse__link"
                                >
                                    Creative Commons BY license
                                </a>
                                . You have the permission to use, distribute,
                                and reproduce these in any medium, provided the
                                source and authors are credited.
                            </li>
                        </ul>
                    </div>

                    {(citationShort || citationLong || citationDatapage) && (
                        <div className="citations grid span-cols-12">
                            <h3 className="citations__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                Citations
                            </h3>
                            <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                {citationDatapage && (
                                    <div className="citations-section">
                                        <h5 className="citation__how-to-header">
                                            How to cite this page
                                        </h5>
                                        <p className="citation__paragraph">
                                            To cite this page overall, including
                                            any descriptions, FAQs or
                                            explanations of the data authored by
                                            Our World in Data, please use the
                                            following citation:
                                        </p>
                                        <CodeSnippet
                                            code={citationDatapage}
                                            theme="light"
                                            useMarkdown={true}
                                        />
                                    </div>
                                )}
                                <div className="citations-section">
                                    <h5 className="citation__how-to-header citation__how-to-header--data">
                                        How to cite this data
                                    </h5>
                                    {(citationShort || citationLong) && (
                                        <DataCitation
                                            citationLong={citationLong}
                                            citationShort={citationShort}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
