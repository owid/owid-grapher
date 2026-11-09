import * as _ from "lodash-es"
import "dayjs"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import {
    GdocsContentSource,
    OwidVariableWithSource,
    gdocIdRegex,
    OwidGdocType,
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
    LinkedAuthor,
    OwidGdocBaseInterface,
} from "@ourworldindata/types"
import { KnexReadonlyTransaction } from "../db/db.js"
import { parseFaqs } from "@ourworldindata/gdoc-pipeline"
import { getSlugForTopicTag } from "./GrapherBakingUtils.js"
import {
    getAuthorTeamAnchorId,
    getShortPageCitation,
} from "../site/gdocs/utils.js"
import { TeamPagePhoto } from "../db/model/Gdoc/GdocBase.js"

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
    )

    return { resolvedFaqs, errors }
}

export const getPrimaryTopic = async (
    knex: KnexReadonlyTransaction,
    tags: string[] = []
) => {
    const firstTopicTag = tags[0]
    if (!firstTopicTag) return undefined

    const topicSlug = await getSlugForTopicTag(knex, firstTopicTag)
    if (!topicSlug) return undefined

    if (topicSlug) {
        // The citation only needs the gdoc's own fields, so skip loading its
        // tags and breadcrumbs (several queries per baked data page)
        const gdoc = await getPublishedGdocBaseObjectBySlug(
            knex,
            topicSlug,
            false,
            [OwidGdocType.TopicPage, OwidGdocType.LinearTopicPage]
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

/**
 * Fill in data managers' photos from the team page where they have no author
 * page photo. People with no author page at all get an empty slug, so they
 * link to their team page entry. Names match across titles and roles, since
 * the team page writes "Dr. Bastian Herre" for the owner "Bastian Herre".
 */
export function addTeamPagePhotos(
    authors: LinkedAuthor[],
    names: string[],
    teamPagePhotos: TeamPagePhoto[]
): LinkedAuthor[] {
    const photosByAnchor = new Map(
        teamPagePhotos.map((photo) => [
            getAuthorTeamAnchorId(photo.name),
            photo,
        ])
    )
    const findPhoto = (name: string): TeamPagePhoto | undefined =>
        photosByAnchor.get(getAuthorTeamAnchorId(name))

    const withAuthorPage = authors.map((author) =>
        author.featuredImage
            ? author
            : {
                  ...author,
                  featuredImage: findPhoto(author.name)?.image ?? null,
              }
    )
    const withoutAuthorPage = names
        .filter((name) => !authors.some((author) => author.name === name))
        .flatMap((name) => {
            const photo = findPhoto(name)
            if (!photo) return []
            return [
                {
                    name,
                    slug: "",
                    featuredImage: photo.image,
                    updatedAt: photo.updatedAt,
                },
            ]
        })
    return [...withAuthorPage, ...withoutAuthorPage]
}
