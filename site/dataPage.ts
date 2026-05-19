import {
    DataPageDataV2,
    DataPageRelatedResearch,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    GrapherInterface,
    intersection,
    omitUndefinedValues,
    OwidVariableWithSource,
} from "@ourworldindata/utils"

export const DEFAULT_PAGE_DESCRIPTION =
    "An interactive visualization from Our World in Data."

export function processRelatedResearch(
    candidates: DataPageRelatedResearch[],
    topicTags: string[]
) {
    let relatedResearch
    if (candidates.length > 3 && topicTags.length > 0) {
        relatedResearch = candidates.filter((research) => {
            const shared = intersection(research.tags, topicTags)
            return shared.length > 0
        })
    } else relatedResearch = [...candidates]

    return relatedResearch
}
export function getDatapageDataV2(
    variableMetadata: OwidVariableWithSource,
    partialGrapherConfig: GrapherInterface,
    options?: {
        // Per-chart override for this indicator's title (typically the
        // dimension's `display.name` set by the chart author). Used in
        // multi-indicator charts where the chart-level `title` describes
        // the whole chart, not any one indicator. When provided, this
        // takes priority over `partialGrapherConfig.title` in the title
        // fallback chain.
        indicatorTitleOverride?: string
    }
): DataPageDataV2 {
    const lastUpdated = getLastUpdatedFromVariable(variableMetadata) ?? ""
    const nextUpdate = getNextUpdateFromVariable(variableMetadata)
    return {
        status: "draft",
        title: variableMetadata.presentation?.titlePublic
            ? omitUndefinedValues({
                  title: variableMetadata.presentation?.titlePublic,
                  attributionShort:
                      variableMetadata.presentation?.attributionShort,
                  titleVariant: variableMetadata.presentation?.titleVariant,
              })
            : {
                  title:
                      options?.indicatorTitleOverride ??
                      partialGrapherConfig.title ??
                      variableMetadata.display?.name ??
                      variableMetadata.name ??
                      "",
              },
        description: variableMetadata.description,
        descriptionShort: variableMetadata.descriptionShort,
        descriptionFromProducer: variableMetadata.descriptionFromProducer,
        attributionShort: variableMetadata.presentation?.attributionShort,
        titleVariant: variableMetadata.presentation?.titleVariant,
        topicTagsLinks: variableMetadata.presentation?.topicTagsLinks ?? [],
        attributions: getAttributionFragmentsFromVariable(variableMetadata),
        descriptionKey: variableMetadata.descriptionKey ?? [],
        descriptionProcessing: variableMetadata.descriptionProcessing,
        owidProcessingLevel: variableMetadata.processingLevel,
        dateRange: variableMetadata.timespan ?? "",
        lastUpdated: lastUpdated,
        nextUpdate: nextUpdate,
        allCharts: [],
        relatedResearch: [],
        relatedContent: [],
        source: variableMetadata.source,
        origins: variableMetadata.origins ?? [],
        chartConfig: partialGrapherConfig as Record<string, unknown>,
        unit: variableMetadata.display?.unit ?? variableMetadata.unit,
        unitConversionFactor: variableMetadata.display?.conversionFactor,
    }
}
