// THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY

// GENERATED BY devTools/schema/generate-default-object-from-schema.ts

import { GrapherInterface } from "@ourworldindata/types"

export const defaultGrapherConfig = {
    $schema: "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
    map: {
        projection: "World",
        hideTimeline: false,
        colorScale: {
            equalSizeBins: true,
            binningStrategy: "ckmeans",
            customNumericColorsActive: false,
            colorSchemeInvert: false,
            binningStrategyBinCount: 5,
        },
        toleranceStrategy: "closest",
        tooltipUseCustomLabels: false,
        time: "latest",
    },
    maxTime: "latest",
    yAxis: {
        removePointsOutsideDomain: false,
        scaleType: "linear",
        canChangeScaleType: false,
        facetDomain: "shared",
    },
    tab: "chart",
    matchingEntitiesOnly: false,
    hasChartTab: true,
    hideLegend: false,
    hideLogo: false,
    hideTimeline: false,
    colorScale: {
        equalSizeBins: true,
        binningStrategy: "ckmeans",
        customNumericColorsActive: false,
        colorSchemeInvert: false,
        binningStrategyBinCount: 5,
    },
    scatterPointLabelStrategy: "year",
    selectedFacetStrategy: "none",
    invertColorScheme: false,
    hideRelativeToggle: true,
    logo: "owid",
    entityType: "country or region",
    facettingLabelByYVariables: "metric",
    addCountryMode: "add-country",
    compareEndPointsOnly: false,
    type: "LineChart",
    hasMapTab: false,
    stackMode: "absolute",
    minTime: "earliest",
    hideAnnotationFieldsInTitle: {
        entity: false,
        time: false,
        changeInPrefix: false,
    },
    xAxis: {
        removePointsOutsideDomain: false,
        scaleType: "linear",
        canChangeScaleType: false,
        facetDomain: "shared",
    },
    hideConnectedScatterLines: false,
    showNoDataArea: true,
    zoomToSelection: false,
    showYearLabels: false,
    hideTotalValueLabel: false,
    hideScatterLabels: false,
    sortBy: "total",
    sortOrder: "desc",
    hideFacetControl: true,
    entityTypePlural: "countries and regions",
    missingDataStrategy: "auto",
} as GrapherInterface
