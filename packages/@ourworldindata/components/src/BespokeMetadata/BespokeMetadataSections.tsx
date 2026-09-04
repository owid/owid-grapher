import { BespokeMetadata } from "@ourworldindata/types"
import {
    getAttributionFragmentsFromBespokeMetadata,
    getIndicatorCitations,
    prepareSourcesForDisplay,
} from "@ourworldindata/utils"
import { ChartLicenseNotice } from "../ChartLicenseNotice/ChartLicenseNotice.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"
import { DataCitation } from "../DataCitation/DataCitation.js"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { IndicatorProcessing } from "../IndicatorProcessing/IndicatorProcessing.js"
import { IndicatorSources } from "../IndicatorSources/IndicatorSources.js"
import { MetadataBoxReuseNotice } from "../MetadataBox/MetadataBoxReuseNotice.js"
import { MetadataBoxSection } from "../MetadataBox/MetadataBoxSection.js"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

export function BespokeMetadataSections({
    metadata,
    citationUrl,
    pageCitation,
}: {
    metadata: BespokeMetadata
    citationUrl?: string
    /** The page's own citation, shown alongside the data's */
    pageCitation?: string
}): React.ReactElement {
    const faqs = metadata.faqs ?? []
    const sources = prepareSourcesForDisplay({
        origins: metadata.origins ?? [],
        source: undefined,
    })
    const attributions = getAttributionFragmentsFromBespokeMetadata(metadata)
    const { short: citationShort, long: citationLong } = getIndicatorCitations({
        indicatorTitle: { title: metadata.title ?? "" },
        origins: metadata.origins ?? [],
        attributions,
        attributionShort: metadata.attributionShort,
        titleVariant: metadata.titleVariant,
        owidProcessingLevel: metadata.processingLevel,
        citationUrl,
    })

    return (
        <>
            <MetadataBoxSection
                title="Frequently asked questions"
                className="metadata-box-section--faqs"
            >
                {faqs.map((faq, i) => (
                    <ExpandableToggle
                        key={faq.question}
                        label={faq.question}
                        isStacked={i < faqs.length - 1}
                        content={<SimpleMarkdownText text={faq.answer} />}
                    />
                ))}
                {metadata.descriptionProcessing && (
                    <ExpandableToggle
                        label="How did Our World in Data process this data?"
                        content={
                            <IndicatorProcessing
                                descriptionProcessing={
                                    metadata.descriptionProcessing
                                }
                            />
                        }
                    />
                )}
            </MetadataBoxSection>
            <MetadataBoxSection title="Documentation from data sources">
                {metadata.descriptionFromProducer && (
                    <ExpandableToggle
                        label={
                            metadata.attributionShort || "Principal data source"
                        }
                        content={
                            <SimpleMarkdownText
                                text={metadata.descriptionFromProducer}
                            />
                        }
                    />
                )}
            </MetadataBoxSection>
            <MetadataBoxSection title="Data sources">
                {sources.length > 0 && (
                    <IndicatorSources
                        sources={sources}
                        isEmbeddedInADataPage={false}
                        hideReuseThisWorkText
                        hideTeasers
                    />
                )}
            </MetadataBoxSection>
            <MetadataBoxSection
                title="How to cite"
                className="bespoke-metadata-sections__citation"
            >
                {pageCitation && (
                    <ExpandableToggle
                        label="How to cite this page"
                        isStacked
                        content={
                            <>
                                <p className="citation__paragraph">
                                    To cite this page overall, including any
                                    descriptions or explanations of the data
                                    authored by Our World in Data, please use
                                    the following citation:
                                </p>
                                <CodeSnippet
                                    code={pageCitation}
                                    theme="light"
                                    useMarkdown={true}
                                />
                            </>
                        }
                    />
                )}
                {attributions.length > 0 && metadata.title && (
                    <ExpandableToggle
                        label="How to cite this data"
                        content={
                            <DataCitation
                                citationShort={citationShort}
                                citationLong={citationLong}
                            />
                        }
                    />
                )}
            </MetadataBoxSection>
            <MetadataBoxSection className="bespoke-metadata-sections__reuse-notice">
                <MetadataBoxReuseNotice>
                    <ChartLicenseNotice license={metadata.license} />
                </MetadataBoxReuseNotice>
            </MetadataBoxSection>
        </>
    )
}
