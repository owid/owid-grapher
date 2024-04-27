import {
    OwidVariableWithSource,
    GrapherInterface,
    FullDatapageData,
    FaqDictionary,
    EnrichedFaq,
    JsonError,
    FaqEntryData,
    OwidChartDimensionInterface,
    DimensionProperty,
    OwidGdocBaseInterface,
    ImageMetadata,
    DataPageRelatedResearch,
} from "@ourworldindata/types"
import { mergePartialGrapherConfigs } from "@ourworldindata/utils"
import lodash, { compact, uniq, partition } from "lodash"
import { getRelatedChartsForVariable } from "../db/model/Chart.js"
import { getGdocBaseObjectBySlug } from "../db/model/Gdoc/GdocFactory.js"
import { parseFaqs } from "../db/model/Gdoc/rawToEnriched.js"
import {
    getPostEnrichedBySlug,
    getRelatedResearchAndWritingForVariable,
} from "../db/model/Post.js"
import { getMergedGrapherConfigForVariable } from "../db/model/Variable.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import { getShortPageCitation } from "../site/gdocs/utils.js"
import { getDatapageGdoc, getDatapageDataV2 } from "./DatapageHelpers.js"
import { getSlugForTopicTag, getTagToSlugMap } from "./GrapherBakingUtils.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { KnexReadWriteTransaction } from "../db/db.js"

type EnrichedFaqLookupError = {
    type: "error"
    error: string
}

type EnrichedFaqLookupSuccess = {
    type: "success"
    enrichedFaq: EnrichedFaq
}

type EnrichedFaqLookupResult = EnrichedFaqLookupError | EnrichedFaqLookupSuccess

export async function fetchDataPageV2Data(
    variableId: number,
    variableMetadata: OwidVariableWithSource,
    isPreviewing: boolean,
    useIndicatorGrapherConfigs: boolean,
    pageGrapher: GrapherInterface | undefined,
    imageMetadataDictionary = {},
    knex: KnexReadWriteTransaction
): Promise<FullDatapageData> {
    const grapherConfigForVariable = await getMergedGrapherConfigForVariable(
        variableId,
        knex
    )
    // Only merge the grapher config on the indicator if the caller tells us to do so -
    // this is true for preview pages for datapages on the indicator level but false
    // if we are on Grapher pages. Once we have a good way in the grapher admin for how
    // to use indicator level defaults, we should reconsider how this works here.
    const grapher = useIndicatorGrapherConfigs
        ? mergePartialGrapherConfigs(grapherConfigForVariable, pageGrapher)
        : pageGrapher ?? {}

    const faqDocs = compact(
        uniq(variableMetadata.presentation?.faqs?.map((faq) => faq.gdocId))
    )
    const gdocFetchPromises = faqDocs.map((gdocId) =>
        getDatapageGdoc(knex, gdocId, isPreviewing)
    )
    const gdocs = await Promise.all(gdocFetchPromises)
    const gdocIdToFragmentIdToBlock: Record<string, FaqDictionary> = {}
    gdocs.forEach((gdoc) => {
        if (!gdoc) return
        const faqs = parseFaqs(
            ("faqs" in gdoc.content && gdoc.content?.faqs) ?? [],
            gdoc.id
        )
        gdocIdToFragmentIdToBlock[gdoc.id] = faqs.faqs
    })

    const resolvedFaqsResults: EnrichedFaqLookupResult[] = variableMetadata
        .presentation?.faqs
        ? variableMetadata.presentation.faqs.map((faq) => {
              const enrichedFaq = gdocIdToFragmentIdToBlock[faq.gdocId]?.[
                  faq.fragmentId
              ] as EnrichedFaq | undefined
              if (!enrichedFaq)
                  return {
                      type: "error",
                      error: `Could not find fragment ${faq.fragmentId} in gdoc ${faq.gdocId}`,
                  }
              return {
                  type: "success",
                  enrichedFaq,
              }
          })
        : []

    const [resolvedFaqs, faqResolveErrors] = partition(
        resolvedFaqsResults,
        (result) => result.type === "success"
    ) as [EnrichedFaqLookupSuccess[], EnrichedFaqLookupError[]]

    if (faqResolveErrors.length > 0) {
        for (const error of faqResolveErrors) {
            await logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Data page error in finding FAQs for variable ${variableId}: ${error.error}`
                )
            )
        }
    }

    const faqEntries: FaqEntryData = {
        faqs: resolvedFaqs?.flatMap((faq) => faq.enrichedFaq.content) ?? [],
    }

    // If we are rendering this in the context of an indicator page preview or similar,
    // then the chart config might be entirely empty. Make sure that dimensions is
    // set to the variableId as a Y variable in theses cases.
    if (
        !grapher.dimensions ||
        (grapher.dimensions as OwidChartDimensionInterface[]).length === 0
    ) {
        const dimensions: OwidChartDimensionInterface[] = [
            {
                variableId: variableId,
                property: DimensionProperty.y,
                display: variableMetadata.display,
            },
        ]
        grapher.dimensions = dimensions
    }
    const datapageData = await getDatapageDataV2(
        variableMetadata,
        grapher ?? {}
    )

    const firstTopicTag = datapageData.topicTagsLinks?.[0]

    let slug = ""
    if (firstTopicTag) {
        try {
            slug = await getSlugForTopicTag(knex, firstTopicTag)
        } catch (error) {
            await logErrorAndMaybeSendToBugsnag(
                `Datapage with variableId "${variableId}" and title "${datapageData.title.title}" is using "${firstTopicTag}" as its primary tag, which we are unable to resolve to a tag in the grapher DB`
            )
        }
        let gdoc: OwidGdocBaseInterface | undefined = undefined
        if (slug) {
            gdoc = await getGdocBaseObjectBySlug(knex, slug, true)
        }
        if (gdoc) {
            const citation = getShortPageCitation(
                gdoc.content.authors,
                gdoc.content.title ?? "",
                gdoc?.publishedAt
            )
            datapageData.primaryTopic = {
                topicTag: firstTopicTag,
                citation,
            }
        } else {
            const post = await getPostEnrichedBySlug(knex, slug)
            if (post) {
                const authors = post.authors
                const citation = getShortPageCitation(
                    authors ?? [],
                    post.title,
                    post.published_at
                )
                datapageData.primaryTopic = {
                    topicTag: firstTopicTag,
                    citation,
                }
            }
        }
    }

    // Get the charts this variable is being used in (aka "related charts")
    // and exclude the current chart to avoid duplicates
    datapageData.allCharts = await getRelatedChartsForVariable(
        knex,
        variableId,
        grapher && "id" in grapher ? [grapher.id as number] : []
    )

    datapageData.relatedResearch =
        (await getRelatedResearchAndWritingForVariable(
            knex,
            variableId
        )) as DataPageRelatedResearch[]

    const relatedResearchFilenames = datapageData.relatedResearch
        .map((r) => r.imageUrl)
        .filter((f): f is string => !!f)

    const imageMetadata = lodash.pick(
        imageMetadataDictionary,
        uniq(relatedResearchFilenames)
    )

    const tagToSlugMap = await getTagToSlugMap(knex)
    return {
        grapher,
        datapageData,
        imageMetadata,
        faqEntries,
        tagToSlugMap,
    }
}
