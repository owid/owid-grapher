export interface DataRangePeersTestCase {
    slug: string
    /** Grapher query params applied on top of the chart's config */
    queryStr?: string
    label: string
}

export interface DataRangePeersTestSection {
    /** Value of the page's `type` query param */
    id: string
    title: string
    cases: DataRangePeersTestCase[]
}

export const DATA_RANGE_PEERS_TEST_SECTIONS: DataRangePeersTestSection[] = [
    {
        id: "sparse-years",
        title: "Few countries have a value in the end year",
        cases: [
            {
                slug: "prevalence-of-undernourishment",
                label: "No country has a value in the end year",
            },
            {
                slug: "health-spending-per-person-by-source",
                label: "7 of 192 countries in the end year",
            },
            {
                slug: "suicide-rate-who-mdb",
                label: "17 of 79 countries in the end year",
            },
            {
                slug: "maternal-mortality-rate-who-mdb",
                label: "17 of 96 countries in the end year",
            },
            {
                slug: "incidence-of-child-labour",
                label: "Survey data",
            },
            {
                slug: "income-share-top-1-before-tax-wid-extrapolations",
                label: "6 of 87 countries in the end year",
            },
            {
                slug: "share-of-the-population-with-basic-numeracy-skills-by-birth-decade",
                label: "Decadal data",
            },
            {
                slug: "distribution-of-population-between-different-poverty-thresholds-stacked-bar",
                label: "Stacked bar, survey data",
            },
            {
                slug: "per-capita-electricity-source-stacked",
                label: "Stacked bar, 88 of 206 countries in the end year",
            },
        ],
    },
    {
        id: "non-countries",
        title: "Few or no countries",
        cases: [
            {
                slug: "number-of-natural-disaster-events",
                label: "Disaster types",
            },
            {
                slug: "global-mine-production-minerals",
                label: "Minerals",
            },
            {
                slug: "plastics-top-rivers",
                label: "Rivers",
            },
            {
                slug: "extinct-species-since-1500",
                label: "Species groups",
            },
            {
                slug: "households-air-conditioning",
                label: "4 countries",
            },
            {
                slug: "nuclear-warhead-inventories",
                label: "9 countries",
            },
        ],
    },
    {
        id: "line",
        title: "Line chart",
        cases: [
            { slug: "child-mortality", label: "Full coverage" },
            {
                slug: "annual-co2-emissions-per-country",
                label: "Skewed values",
            },
            { slug: "life-expectancy", label: "Full coverage" },
            {
                slug: "gdp-per-capita-worldbank",
                queryStr: "tab=line",
                label: "Skewed values",
            },
            { slug: "co-emissions-per-capita", label: "Skewed values" },
            { slug: "median-age", label: "Micro-states picked with a target" },
            {
                slug: "share-of-total-energy-used-in-agriculture-and-forestry",
                label: "Micro-states picked with a target",
            },
            {
                slug: "the-number-of-reported-paralytic-polio-cases",
                label: "Case counts",
            },
            {
                slug: "new-reported-cases-tetanus",
                label: "Case counts",
            },
            { slug: "foreign-aid-given-net", label: "Donor countries only" },
            {
                slug: "population-with-un-projections",
                label: "Projections",
            },
        ],
    },
    {
        id: "discrete-bar",
        title: "Bar chart",
        cases: [
            {
                slug: "share-of-global-merchandise-exports",
                label: "Skewed values",
            },
            {
                slug: "total-gov-expenditure-percapita-oecd",
                label: "OECD countries",
            },
            {
                slug: "children-lead-5micrograms",
                label: "34 countries",
            },
            {
                slug: "share-of-fish-stocks-overexploited",
                label: "Regions and countries",
            },
            {
                slug: "female-to-male-ratio-of-time-devoted-to-unpaid-care-work",
                label: "Survey data",
            },
            {
                slug: "public-opposition-to-nuclear-energy-production",
                label: "24 countries",
            },
            {
                slug: "life-expectancy",
                queryStr: "tab=discrete-bar",
                label: "Full coverage",
            },
        ],
    },
    {
        id: "stacked-discrete-bar",
        title: "Stacked bar chart",
        cases: [
            {
                slug: "population-young-working-old",
                label: "Full coverage",
            },
            { slug: "food-waste-per-capita", label: "Full coverage" },
            { slug: "fertilizer-per-hectare", label: "Skewed values" },
            { slug: "per-capita-energy-stacked", label: "Skewed values" },
            {
                slug: "share-of-population-by-religious-affiliation",
                label: "Shares",
            },
            {
                slug: "access-drinking-water-stacked",
                label: "Shares",
            },
            {
                slug: "cumulative-deaths-in-armed-conflicts-by-country-region-and-type",
                label: "Cumulative counts",
            },
        ],
    },
    {
        id: "slope",
        title: "Slope chart",
        cases: [
            {
                slug: "maternal-mortality-slope-chart",
                label: "Full coverage",
            },
            {
                slug: "share-of-adults-who-report-saving-money-in-the-past-year",
                label: "Survey data",
            },
            {
                slug: "cost-drugs-extensive-resistant-tb",
                label: "Fewer countries at both ends",
            },
            { slug: "share-food-exports", label: "24 countries" },
            {
                slug: "life-expectancy",
                queryStr: "tab=slope",
                label: "Full coverage",
            },
        ],
    },
    {
        id: "dumbbell",
        title: "Dumbbell chart",
        cases: [
            {
                slug: "prevalence-of-hiv-percentage-of-males-and-females-ages-15-24-infected-with-hiv",
                label: "Two indicators",
            },
            {
                slug: "learning-adjusted-years-of-schooling-gender-scatter",
                label: "Two indicators",
            },
            {
                slug: "female-labor-force-participation-rates-latest-vs-1980",
                label: "Two years",
            },
        ],
    },
]
