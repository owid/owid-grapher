export interface ThumbnailTestCase {
    slug: string
    /** Grapher query params applied on top of the chart's config */
    queryStr?: string
    label: string
}

export interface ThumbnailTestSection {
    /** Value of the page's `type` query param */
    id: string
    title: string
    cases: ThumbnailTestCase[]
}

const MANY_COUNTRIES =
    "USA~DEU~CHN~IND~BRA~NGA~JPN~GBR~FRA~ITA~ESP~MEX~RUS~ZAF~IDN~EGY"

/** Section of faceted charts of any type */
export const FACET_SECTION_ID = "facet"

const LONG_NAME_COUNTRIES = "COD~CAF~BIH~VCT~TTO~USA~FSM~STP"

export const THUMBNAIL_TEST_SECTIONS: ThumbnailTestSection[] = [
    {
        id: "line",
        title: "Line chart",
        cases: [
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: "tab=line",
                label: "Several entities",
            },
            { slug: "life-expectancy", label: "Several entities" },
            {
                slug: "global-gdp-over-the-long-run",
                label: "Single entity",
            },
            {
                slug: "co-emissions-per-capita",
                queryStr: `country=${MANY_COUNTRIES}`,
                label: "Many entities",
            },
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: `tab=line&country=${LONG_NAME_COUNTRIES}`,
                label: "Long entity names",
            },
            {
                slug: "share-elec-by-source",
                label: "One entity, several indicators",
            },
            {
                slug: "temperature-anomaly",
                label: "Several indicators, negative values",
            },
            {
                slug: "number-of-measles-cases",
                label: "Log axis",
            },
            {
                slug: "historical-cost-of-computer-memory-and-storage",
                label: "Several indicators on a log axis",
            },
            {
                slug: "annual-co2-emissions-per-country",
                queryStr: "yScale=log",
                label: "Log axis switched on",
            },
            {
                slug: "kaya-identity-co2",
                label: "Relative change",
            },
            {
                slug: "annual-co2-emissions-per-country",
                queryStr: "stackMode=relative",
                label: "Relative change switched on",
            },
            {
                slug: "population-with-un-projections",
                label: "Projections",
            },
            {
                slug: "population-with-un-projections",
                queryStr: "country=OWID_WRL~IND~CHN~NGA",
                label: "Projections, several entities",
            },
            {
                slug: "births-and-deaths-projected-to-2100",
                label: "Projections, several indicators",
            },
            {
                slug: "real-gdp-growth",
                label: "Faceted by entity",
            },
            {
                slug: "electric-car-sales-share",
                label: "Faceted by entity",
            },
            {
                slug: "measles-cases-and-death-rate",
                label: "Faceted by metric",
            },
            {
                slug: "annual-death-rates-in-different-age-groups",
                label: "Faceted by metric, several entities",
            },
            {
                slug: "life-expectancy",
                queryStr: "time=2000..latest",
                label: "Short time range",
            },
        ],
    },
    {
        id: "discrete-bar",
        title: "Discrete bar chart",
        cases: [
            {
                slug: "death-rates-from-energy-production-per-twh",
                label: "Several entities",
            },
            {
                slug: "ghg-per-kg-poore",
                label: "Many entities",
            },
            {
                slug: "annual-number-of-deaths-by-cause",
                label: "One entity, many indicators",
            },
            {
                slug: "diabetes-prevalence",
                queryStr: "tab=discrete-bar",
                label: "Regions",
            },
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: `tab=discrete-bar&country=${LONG_NAME_COUNTRIES}`,
                label: "Long entity names",
            },
            {
                slug: "child-mortality",
                queryStr: `tab=discrete-bar&country=${MANY_COUNTRIES}`,
                label: "Switched from a line chart, many entities",
            },
        ],
    },
    {
        id: "slope",
        title: "Slope chart",
        cases: [
            {
                slug: "share-plastic-waste-recycled",
                label: "Several entities",
            },
            {
                slug: "whale-populations",
                label: "Several entities",
            },
            {
                slug: "maternal-mortality-slope-chart",
                label: "Several indicators",
            },
            {
                slug: "share-of-adults-borrowing-from-different-sources",
                label: "Faceted by entity",
            },
            {
                slug: "child-mortality",
                queryStr: "tab=slope&time=1990..latest",
                label: "Switched from a line chart",
            },
            {
                slug: "child-mortality",
                queryStr: `tab=slope&time=1990..latest&country=${MANY_COUNTRIES}`,
                label: "Switched from a line chart, many entities",
            },
        ],
    },
    {
        id: "stacked-area",
        title: "Stacked area chart",
        cases: [
            { slug: "population-by-age-group", label: "Indicators as series" },
            {
                slug: "global-primary-energy-by-source",
                label: "Many indicators as series",
            },
            {
                slug: "annual-co-emissions-by-region",
                label: "Entities as series",
            },
            {
                slug: "annual-co-emissions-by-region",
                queryStr: "stackMode=relative",
                label: "Entities as series, relative",
            },
            {
                slug: "share-employment-agriculture-industry-services",
                label: "Relative",
            },
            {
                slug: "population-regions-with-projections",
                label: "Projections",
            },
            {
                slug: "per-capita-meat-consumption-by-type-kilograms-per-year",
                queryStr: "facet=entity&country=OWID_WRL~USA~CHN~BRA",
                label: "Faceted by entity",
            },
        ],
    },
    {
        id: "stacked-bar",
        title: "Stacked bar chart",
        cases: [
            {
                slug: "natural-disasters-by-type",
                label: "Entities as series",
            },
            {
                slug: "solar-pv-cumulative-capacity",
                label: "One entity, legend hidden by the config",
            },
            {
                slug: "solar-pv-cumulative-capacity",
                queryStr: "country=OWID_WRL~CHN&facet=none",
                label: "Same chart with two entities, legend shown",
            },
            {
                slug: "car-sales",
                label: "Two indicators",
            },
            {
                slug: "number-of-armed-conflicts",
                label: "Several indicators",
            },
            {
                slug: "deaths-in-armed-conflicts-by-type",
                queryStr: "stackMode=relative",
                label: "Several indicators, relative",
            },
            {
                slug: "annual-temperature-anomalies",
                queryStr: "tab=stacked-bar",
                label: "Negative values",
            },
            {
                slug: "deaths-in-armed-conflicts-by-country",
                queryStr: "tab=stacked-bar",
                label: "Faceted by entity",
            },
        ],
    },
    {
        id: "stacked-discrete-bar",
        title: "Stacked discrete bar chart",
        cases: [
            {
                slug: "food-emissions-supply-chain",
                label: "Many bars",
            },
            { slug: "per-capita-meat-type", label: "Several bars" },
            {
                slug: "per-capita-energy-stacked",
                label: "Many indicators",
            },
            {
                slug: "acceptability-of-uk-farming-practices",
                label: "Relative",
            },
            {
                slug: "government-spending-by-function",
                label: "Many indicators, few bars",
            },
        ],
    },
    {
        id: "scatter",
        title: "Scatter plot",
        cases: [
            { slug: "birth-rate-vs-death-rate", label: "Colored points" },
            {
                slug: "life-expectancy-vs-health-expenditure",
                label: "Colored points",
            },
            {
                slug: "life-expectancy-vs-gdp-per-capita",
                label: "Sized and colored points",
            },
            {
                slug: "cost-space-launches-low-earth-orbit",
                label: "Time on the x-axis",
            },
            {
                slug: "covid-vaccinations-vs-covid-death-rate",
                label: "Selected entities",
            },
            {
                slug: "life-expectancy-vs-gdp-per-capita",
                queryStr: "time=1950..2020&country=USA~CHN~IND~NGA~BRA",
                label: "Connected",
            },
        ],
    },
    {
        id: "marimekko",
        title: "Marimekko",
        cases: [
            {
                slug: "multidimensional-poverty-index-mpi",
                queryStr: "tab=marimekko",
                label: "Default",
            },
            {
                slug: "human-capital-index-in-2018",
                queryStr: "tab=marimekko",
                label: "Many entities",
            },
            {
                slug: "life-expectancy-marimekko",
                label: "Colored by region",
            },
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: "tab=marimekko",
                label: "Switched from a line chart",
            },
        ],
    },
    {
        id: "map",
        title: "Map",
        cases: [
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: "tab=map",
                label: "Numeric",
            },
            {
                slug: "democracy-index-eiu",
                queryStr: "tab=map",
                label: "Numeric, bounded scale",
            },
            {
                slug: "population-density",
                queryStr: "tab=map",
                label: "Numeric, many bins",
            },
            {
                slug: "urban-vs-rural-majority",
                label: "Two categories",
            },
            {
                slug: "world-regions-according-to-the-world-bank",
                label: "Many categories",
            },
            {
                slug: "most-common-religion",
                label: "Categories",
            },
            {
                slug: "population-with-un-projections",
                queryStr: "tab=map&time=2050",
                label: "Projected year",
            },
        ],
    },
    {
        id: "dumbbell",
        title: "Dumbbell chart",
        cases: [
            {
                slug: "time-spend-in-domestic-work-female-vs-male",
                label: "Two indicators",
            },
            {
                slug: "female-labor-force-participation-rates-latest-vs-1980",
                label: "Two times, many entities",
            },
            {
                slug: "prevalence-of-hiv-percentage-of-males-and-females-ages-15-24-infected-with-hiv",
                label: "Two indicators",
            },
            {
                slug: "liberal-democracy-index",
                queryStr: "tab=dumbbell",
                label: "Switched from a line chart",
            },
        ],
    },
    {
        id: "swimlane",
        title: "Swimlane",
        cases: [
            {
                slug: "world-bank-income-groups",
                queryStr: "tab=swimlane",
                label: "Ordinal categories",
            },
            {
                slug: "political-regime",
                queryStr: "tab=swimlane",
                label: "Categories",
            },
            {
                slug: "european-overseas-colonies-and-their-colonizers",
                queryStr: "tab=swimlane",
                label: "Many categories",
            },
            {
                slug: "universal-suffrage-women-lexical",
                queryStr: "tab=swimlane",
                label: "Yes/no categories",
            },
            {
                slug: "country-position-nuclear-weapons",
                queryStr: "tab=swimlane",
                label: "Few entities, frequent changes",
            },
            {
                slug: "political-regime",
                queryStr: `tab=swimlane&country=${MANY_COUNTRIES}`,
                label: "Many entities",
            },
        ],
    },
    {
        id: FACET_SECTION_ID,
        title: "Faceted",
        cases: [
            {
                slug: "electric-car-sales-share",
                label: "Line chart by entity",
            },
            {
                slug: "real-gdp-growth",
                label: "Line chart by entity, negative values",
            },
            {
                slug: "measles-cases-and-death-rate",
                label: "Line chart by metric",
            },
            {
                slug: "drivers-deforestation-commodity",
                label: "Line chart by metric, many facets",
            },
            {
                slug: "annual-death-rates-in-different-age-groups",
                label: "Line chart by metric, several entities",
            },
            {
                slug: "per-capita-meat-consumption-by-type-kilograms-per-year",
                queryStr: "facet=entity&country=OWID_WRL~USA~CHN~BRA",
                label: "Stacked area by entity",
            },
            {
                slug: "number-of-people-with-blindness-due-to-each-cause",
                label: "Stacked area by metric",
            },
            {
                slug: "deaths-in-armed-conflicts-by-type-and-country",
                label: "Stacked bar by entity",
            },
            {
                slug: "airliner-hijackings-and-fatalities-from-them",
                label: "Stacked bar by metric",
            },
            {
                slug: "environmental-footprint-milks",
                label: "Discrete bar by metric",
            },
            {
                slug: "antibiotic-use-intensity-in-livestock-by-region",
                label: "Discrete bar by entity",
            },
            {
                slug: "materials-low-carbon-electricity",
                label: "Stacked discrete bar by entity",
            },
            {
                slug: "share-of-adults-borrowing-from-different-sources",
                label: "Slope chart by entity",
            },
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: "tab=map&time=2000..latest",
                label: "Map comparing two years",
            },
        ],
    },
]
