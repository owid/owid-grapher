import "dayjs"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import {
    OwidGdocInterface,
    GdocsContentSource,
    DataPageDataV2,
    OwidVariableWithSource,
    gdocIdRegex,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    OwidProcessingLevel,
} from "@ourworldindata/utils"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { Gdoc } from "../db/model/Gdoc/Gdoc.js"
import { GrapherInterface } from "@ourworldindata/grapher"

export const getDatapageDataV2 = async (
    variableMetadata: OwidVariableWithSource,
    partialGrapherConfig: GrapherInterface
): Promise<DataPageDataV2> => {
    {
        const processingLevel =
            variableMetadata.processingLevel ?? "minor"
        const lastUpdated = getLastUpdatedFromVariable(variableMetadata) ?? ""
        const nextUpdate = getNextUpdateFromVariable(variableMetadata)
        const datapageJson: DataPageDataV2 = {
            status: "draft",
            title:
                variableMetadata.presentation?.titlePublic ??
                partialGrapherConfig.title ??
                variableMetadata.display?.name ??
                variableMetadata.name ??
                "",
            descriptionShort: variableMetadata.descriptionShort,
            descriptionFromProducer: variableMetadata.descriptionFromProducer,
            attributionShort: variableMetadata.presentation?.attributionShort,
            titleVariant: variableMetadata.presentation?.titleVariant,
            topicTagsLinks: variableMetadata.presentation?.topicTagsLinks ?? [],
            attributions: getAttributionFragmentsFromVariable(variableMetadata),
            faqs: [],
            descriptionKey: variableMetadata.descriptionKey ?? [],
            descriptionProcessing: variableMetadata.descriptionProcessing,
            owidProcessingLevel: processingLevel,
            dateRange: variableMetadata.timespan ?? "",
            lastUpdated: lastUpdated,
            nextUpdate: nextUpdate,
            relatedData: [],
            allCharts: [],
            relatedResearch: [],
            source: variableMetadata.source,
            origins: variableMetadata.origins ?? [],
            chartConfig: partialGrapherConfig as Record<string, unknown>,
            unit: variableMetadata.display?.unit ?? variableMetadata.unit,
        }
        return datapageJson
    }
}

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
    googleDocEditLinkOrId: string,
    isPreviewing: boolean,
    publishedExplorersBySlug?: Record<string, ExplorerProgram>
): Promise<OwidGdocInterface | null> => {
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

    const datapageGdoc =
        isPreviewing && publishedExplorersBySlug && Gdoc.areGdocAuthKeysSet()
            ? await Gdoc.getGdocFromContentSource(
                  googleDocId,
                  publishedExplorersBySlug,
                  GdocsContentSource.Gdocs
              )
            : await Gdoc.findOneBy({ id: googleDocId })

    return datapageGdoc
}
