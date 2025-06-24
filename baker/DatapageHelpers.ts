import * as _ from "lodash-es"
import "dayjs"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import {
    GdocsContentSource,
    OwidVariableWithSource,
    gdocIdRegex,
} from "@ourworldindata/utils"
import {
    getGdocBaseObjectById,
    getPublishedGdocBaseObjectBySlug,
    loadGdocFromGdocBase,
} from "../db/model/Gdoc/GdocFactory.js"
import { OwidGoogleAuth } from "../db/OwidGoogleAuth.js"
import {
    EnrichedFaq,
    FaqDictionary,
    OwidGdocBaseInterface,
} from "@ourworldindata/types"
import { KnexReadonlyTransaction } from "../db/db.js"
import { parseFaqs } from "../db/model/Gdoc/rawToEnriched.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import { getSlugForTopicTag } from "./GrapherBakingUtils.js"
import { getShortPageCitation } from "../site/gdocs/utils.js"

/**
 * Get the datapage companion gdoc, if any.
 *
 * When previewing, we want to render the datapage from the live gdoc.
 * Otherwise, we're baking from the gdoc parsed and saved in the database
 * following a visit to /admin/gdocs/[googleDocId]/preview
 *
 * see https://github.com/owid/owid-grapher/issues/2121#issue-1676097164
 */
export const getDatapageGdoc = async (
    knex: KnexReadonlyTransaction,
    googleDocEditLinkOrId: string,
    isPreviewing: boolean
): Promise<OwidGdocBaseInterface | null> => {
    // Get the google doc id from the datapage JSON file and return early if
    // none found
    const isPlainGoogleId = gdocIdRegex.exec(googleDocEditLinkOrId)
    const googleDocId = isPlainGoogleId
        ? googleDocEditLinkOrId
        : getLinkType(googleDocEditLinkOrId) === "gdoc"
          ? getUrlTarget(googleDocEditLinkOrId)
          : null

    if (!googleDocId) return null

    // When previewing, we want to render the datapage from the live gdoc, but
    // only if the user has set up the necessary auth keys to access the Google
    // Doc API. This won't be the case for external contributors or possibly
    // data engineers focusing on the data pipeline. In those cases, we grab the
    // gdoc found in the database, if any. This use case doesn't currently
    // support images (imageMetadata won't be set).

    let datapageGdoc =
        (await getGdocBaseObjectById(knex, googleDocId, true)) ?? null

    if (datapageGdoc && isPreviewing && OwidGoogleAuth.areGdocAuthKeysSet())
        datapageGdoc = await loadGdocFromGdocBase(
            knex,
            datapageGdoc,
            GdocsContentSource.Gdocs
        )

    return datapageGdoc
}

type EnrichedFaqLookupError = {
    type: "error"
    error: string
}

type EnrichedFaqLookupSuccess = {
    type: "success"
    enrichedFaq: EnrichedFaq
}

type EnrichedFaqLookupResult = EnrichedFaqLookupError | EnrichedFaqLookupSuccess

export const fetchAndParseFaqs = async (
    knex: KnexReadonlyTransaction,
    faqGdocIds: string[],
    { isPreviewing }: { isPreviewing: boolean }
) => {
    const gdocFetchPromises = faqGdocIds.map((gdocId) =>
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

    return gdocIdToFragmentIdToBlock
}

export const resolveFaqsForVariable = (
    gdocIdToFragmentIdToBlock: Record<string, FaqDictionary>,
    variableMetadata: OwidVariableWithSource
) => {
    const resolvedFaqResults: EnrichedFaqLookupResult[] = variableMetadata
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

    const [resolvedFaqs, errors] = _.partition(
        resolvedFaqResults,
        (result) => result.type === "success"
    ) as [EnrichedFaqLookupSuccess[], EnrichedFaqLookupError[]]

    return { resolvedFaqs, errors }
}

export const getPrimaryTopic = async (
    knex: KnexReadonlyTransaction,
    tags: string[] = [],
    slug: string | undefined
) => {
    const firstTopicTag = tags[0]
    if (!firstTopicTag) return undefined

    let topicSlug: string
    try {
        topicSlug = await getSlugForTopicTag(knex, firstTopicTag)
    } catch {
        await logErrorAndMaybeCaptureInSentry(
            new Error(
                `Data page with slug "${slug}" is using "${firstTopicTag}" as its primary tag, which we are unable to resolve to a tag in the grapher DB`
            )
        )
        return undefined
    }

    if (topicSlug) {
        const gdoc = await getPublishedGdocBaseObjectBySlug(
            knex,
            topicSlug,
            true
        )
        if (gdoc) {
            const citation = getShortPageCitation(
                gdoc.content.authors,
                gdoc.content.title ?? "",
                gdoc?.publishedAt
            )
            return { topicTag: firstTopicTag, citation }
        }
    }
    return undefined
}
