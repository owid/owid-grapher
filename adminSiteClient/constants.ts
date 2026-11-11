const GDOC_ATTACHMENT_PROPERTIES = [
    "imageMetadata",
    "linkedCharts",
    "linkedDocuments",
    "linkedNarrativeCharts",
    "linkedStaticViz",
    "linkedCallouts",
]

// Non-deterministic values which shouldn't be displayed in the diff viewer
// Errors are already shown in the settings drawer, so we don't show those either
export const GDOC_DIFF_OMITTABLE_PROPERTIES = [
    "errors",
    ...GDOC_ATTACHMENT_PROPERTIES,
]

// Version-agnostic catalog paths for the indicators we use as defaults when
// setting up a scatter plot in the admin. The `latest` placeholder stands in
// for the version segment
export const POPULATION_CATALOG_PATH =
    "grapher/demography/latest/population/population#population"
export const GDP_PER_CAPITA_CATALOG_PATH =
    "grapher/worldbank_wdi/latest/wdi/wdi#ny_gdp_pcap_pp_kd"
