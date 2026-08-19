// Non-deterministic values which shouldn't be displayed in the diff viewer
// Errors are already shown in the settings drawer, so we don't show those either
export const GDOC_DIFF_OMITTABLE_PROPERTIES = [
    "errors",
    // imageMetadata *does* count as something that meaningfully contributes to whether a Gdoc is different,
    // And it's checked in the checkIsLightningUpdate function,
    // but for the preview, it's already captured by changes to the body text, so we don't need to show these objects in the diff also
    "imageMetadata",
    "linkedCharts",
    "linkedDocuments",
    "relatedCharts",
    "linkedNarrativeCharts",
    "linkedStaticViz",
    "linkedCallouts",
]

// Version-agnostic catalog paths for the indicators we use as defaults when
// setting up a scatter plot in the admin. The `latest` placeholder stands in
// for the version segment
export const POPULATION_CATALOG_PATH =
    "grapher/demography/latest/population/population#population"
export const GDP_PER_CAPITA_CATALOG_PATH =
    "grapher/worldbank_wdi/latest/wdi/wdi#ny_gdp_pcap_pp_kd"
