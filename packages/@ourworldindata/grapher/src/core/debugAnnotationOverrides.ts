/**
 * DEBUG ONLY, NOT FOR SHIPPING. Delete this file and its call sites in
 * `loadVariable.ts` before opening a pull request.
 *
 * No indicator in the ETL has annotations yet. This merges made-up ones into
 * a few indicators' metadata as they are fetched, so line chart annotations
 * can be checked against real charts locally.
 */

import {
    OwidVariableAnnotation,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"

const FAKE_ANNOTATIONS_BY_VARIABLE_ID: Record<
    number,
    OwidVariableAnnotation[]
> = {
    // life-expectancy, which selects World and the continents
    1118466: [
        {
            text: "Life expectancy fell sharply during the [Great Chinese Famine](https://en.wikipedia.org/wiki/Great_Chinese_Famine), when tens of millions of people died.",
            entities: ["China"],
            time: 1960,
        },
        {
            text: "Data before 1950 is only available for a handful of years.",
            entities: ["Europe"],
            time: 1950,
        },
        {
            text: "Life expectancy fell in many countries during the **COVID-19 pandemic**.",
            entities: ["Europe", "Americas"],
            time: 2020,
        },
        {
            text: "Asia's 2020 estimate rests on incomplete death registration in several large countries.",
            entities: ["Asia"],
            time: 2020,
        },
        {
            // no data point in 1918, the nearest are 1913 and 1950
            text: "The 1918 influenza pandemic killed an estimated 50 million people.",
            entities: ["World"],
            time: 1918,
        },
        {
            text: "The HIV/AIDS epidemic stalled progress across much of the continent.",
            entities: ["Africa"],
            time: 1985,
            timeEnd: 2005,
        },
        {
            // inside the segment from 1913 to 1950
            text: "Two world wars and the Spanish flu left few reliable records of life expectancy.",
            entities: ["World"],
            time: 1915,
            timeEnd: 1940,
        },
        {
            // spans the Europe 1950 point
            text: "The Second World War and its aftermath disrupted vital registration across Europe.",
            entities: ["Europe"],
            time: 1940,
            timeEnd: 1960,
        },
        {
            // ends after the last data point
            text: "Projections assume continued recovery after the COVID-19 pandemic.",
            entities: ["Asia"],
            time: 2015,
            timeEnd: 2030,
        },
        // Real examples from here on
        {
            text: "Global life expectancy dipped during China's Great Leap Forward, when tens of millions died in the [Great Chinese Famine](https://en.wikipedia.org/wiki/Great_Chinese_Famine).",
            entities: ["World"],
            time: 1960,
        },
        {
            text: "Global life expectancy fell during the COVID-19 pandemic.",
            entities: ["World"],
            time: 2021,
        },
        // Income groups, whose whole name opens a region tooltip
        {
            text: "Life expectancy fell in high-income countries during the COVID-19 pandemic.",
            entities: ["High-income countries"],
            time: 2020,
        },
        {
            text: "The countries in this group change over time as the World Bank reclassifies them.",
            entities: ["Low-income countries"],
            time: 1990,
            timeEnd: 2005,
        },
        // Entity annotation on an income group, for the discrete bar's region tooltip
        {
            text: "Income groups follow the World Bank's 2024 classification, which sorts countries by their gross national income per person.",
            entities: ["High-income countries"],
        },
    ],
    // food-supply-vs-life-expectancy (a scatter plot), life-expectancy-un,
    // and the historical half of life-expectancy-at-birth-including-the-un-projections
    950927: [
        {
            text: "A life expectancy of 19 years is far below every other year for the Central African Republic and is most likely a data error.",
            entities: ["Central African Republic"],
            time: 2022,
        },
        // Entity annotations: historical only, both different, both the same
        {
            text: "Estimates before 1950 rely on incomplete death registration.",
            entities: ["Japan"],
        },
        {
            text: "Historical estimates rest on the Sample Registration System.",
            entities: ["India"],
        },
        {
            text: "UN World Population Prospects 2024 revision.",
            entities: ["World"],
        },
    ],
    // the projection half of life-expectancy-at-birth-including-the-un-projections
    950931: [
        // Entity annotations: projection only, both different, both the same
        {
            text: "Projections assume a recovery from the Zika and COVID-19 shocks.",
            entities: ["Brazil"],
        },
        {
            text: "Projections follow the UN medium fertility variant.",
            entities: ["India"],
        },
        {
            text: "UN World Population Prospects 2024 revision.",
            entities: ["World"],
        },
    ],
    // births-and-deaths-projected-to-2100: deaths (estimates), deaths
    // (projection), births (estimates); births (projection) stays unannotated
    950690: [
        {
            text: "Death counts for the 1980s and 1990s are modelled from few surveys.",
            entities: ["Afghanistan"],
        },
    ],
    950692: [
        {
            text: "Projected deaths assume no return to large-scale conflict.",
            entities: ["Afghanistan"],
        },
    ],
    950616: [
        {
            text: "Birth counts are modelled from few surveys.",
            entities: ["Afghanistan"],
        },
    ],
    // change-in-food-supply-population-and-agricultural-land-use?country=~Africa+(FAO)
    // Entity annotations: World differs per indicator, Africa (FAO) repeats one
    // text on two indicators, land use (1205675) stays unannotated
    1205676: [
        {
            text: "The jump comes from a change in which countries the FAO has data for, not a real rise in food supply.",
            entities: ["Africa (FAO)"],
            time: 2010,
        },
        {
            text: "Food supply measures food available for consumption, not food eaten.",
            entities: ["World"],
        },
        {
            text: "The countries in this FAO region change over time.",
            entities: ["Africa (FAO)"],
        },
    ],
    1205674: [
        {
            text: "The jump comes from a change in which countries the FAO has data for, not a real rise in population.",
            entities: ["Africa (FAO)"],
            time: 2010,
        },
        {
            text: "Population follows the UN World Population Prospects.",
            entities: ["World"],
        },
        {
            text: "The countries in this FAO region change over time.",
            entities: ["Africa (FAO)"],
        },
    ],
    // global-food explorer, Food=Chestnut, Metric=Production, country=~ESP
    1198056: [
        {
            text: "Spain's reported chestnut production rises tenfold from 2018 and stays there. The jump is most likely an error in the FAO data rather than a real increase. Treat the figures from 2018 onward with caution, and compare with earlier years only with care.",
            entities: ["Spain"],
            time: 2018,
            timeEnd: 2024,
        },
    ],
    // share-of-adults-defined-as-obese?tab=line&country=GBR~FRA
    1248813: [
        {
            text: "The decline in adult obesity in France is probably not real. It may be a data quality issue in the estimates, which we are still investigating.",
            entities: ["France"],
            time: 2010,
            timeEnd: 2024,
        },
    ],
    // chicken-meat-production?tab=line&country=~FRA
    1198671: [
        {
            text: "The abrupt rise and fall over these years is most likely a data issue, not a real change in production.",
            entities: ["France"],
            time: 1991,
            timeEnd: 1999,
        },
    ],
    // maternal-mortality?tab=line&time=1962..latest
    959831: [
        {
            text: "The rise is largely an artefact of measurement. US states added a pregnancy checkbox to death certificates at different times between 2003 and 2017, which identified more maternal deaths. [Read more](https://ourworldindata.org/rise-us-maternal-mortality-rates-measurement).",
            entities: ["United States"],
            time: 2003,
            timeEnd: 2020,
        },
    ],
    // gdp-per-capita-penn-world-table?tab=line&country=~TZA
    1108541: [
        {
            text: "This drop is most likely an artefact of Tanzania's national accounts data. [Read more](https://www.global-developments.org/p/how-much-should-we-trust-developing).",
            entities: ["Tanzania"],
            time: 1985,
            timeEnd: 1995,
        },
    ],
    // co-emissions-per-capita
    1119914: [
        {
            text: "Historical data on emissions and population for Sint Maarten is uncertain.",
            entities: ["Sint Maarten (Dutch part)"],
            time: 1950,
            timeEnd: 1985,
        },
        // Entity annotations: a short one, and a long one that wraps
        {
            text: "Includes emissions from Hong Kong and Macao.",
            entities: ["China"],
        },
        {
            text: "Emissions are territorial: they count fossil fuels burned within India's borders and leave out the emissions embedded in goods India imports from other countries.",
            entities: ["India"],
        },
        // Point annotations on China, on a trajectory from 1990 to 2000
        {
            // at the start of the trajectory, next to the entity annotation
            text: "Emissions before 2000 are less certain.",
            entities: ["China"],
            time: 1990,
        },
        {
            // in the middle of the trajectory, so it must not show
            text: "Emissions fell in 1995.",
            entities: ["China"],
            time: 1995,
        },
        {
            // at the end of the trajectory
            text: "Emissions from 2000 follow the revised inventory.",
            entities: ["China"],
            time: 2000,
        },
    ],
    // forest-area-as-share-of-land-area?tab=line&country=~Scotland, which has a legacy annotation
    1132530: [
        {
            text: "Before 1600, forest likely covered 25–50% of Scotland. We omit these years because the estimates are very uncertain.",
            entities: ["Scotland"],
            time: 1600,
        },
    ],
    // share-of-children-immunized-dtp3
    1325479: [
        {
            text: "Routine immunization was disrupted during the COVID-19 pandemic.",
            entities: ["Africa (WHO)"],
            time: 2020,
        },
        {
            // long name, so "(WHO)" can drop to its own line
            text: "Conflict in several countries held back coverage.",
            entities: ["Eastern Mediterranean (WHO)"],
            time: 2020,
        },
        {
            text: "Coverage estimates for these years rest on few country surveys.",
            entities: ["Africa (WHO)"],
            time: 1990,
            timeEnd: 2000,
        },
    ],
    // foreign-aid-given-net, where "Non-DAC countries" has a legacy annotation
    1293408: [
        {
            text: "Aid from non-DAC donors rose after the invasion of Ukraine.",
            entities: ["Non-DAC countries"],
            time: 2022,
        },
        {
            // long name that wraps onto several lines
            text: "Gavi's disbursements peaked during the COVID-19 vaccine rollout.",
            entities: ["Global Alliance for Vaccines and Immunization"],
            time: 2022,
        },
    ],
    // monthly-temperature-anomalies, on a daily time axis
    1306418: [
        {
            text: "The 2015–16 El Niño was one of the strongest on record.",
            entities: ["World"],
            time: "2016-02-15",
        },
        {
            text: "Global temperatures stayed high for a year around the El Niño peak.",
            entities: ["World"],
            time: "2015-06-15",
            timeEnd: "2016-06-15",
        },
    ],
    // time-spend-in-domestic-work-female-vs-male (a two-indicator dumbbell):
    // female hours. India shares its text with the male indicator, Brazil
    // differs, Germany is annotated on the female indicator only
    1304682: [
        {
            text: "Time-use survey from 2019.",
            entities: ["India"],
        },
        {
            text: "Women's hours include caring for children.",
            entities: ["Brazil"],
        },
        {
            text: "Survey covers urban areas only.",
            entities: ["Germany"],
        },
    ],
    // male hours
    1304683: [
        {
            text: "Time-use survey from 2019.",
            entities: ["India"],
        },
        {
            text: "Men's hours exclude repairs and gardening.",
            entities: ["Brazil"],
        },
    ],
    // share-of-children-vaccinated-against-measles-vs-share-vaccinated-against-dpt3
    // (a crowded two-indicator dumbbell): measles
    1077441: [
        {
            text: "Coverage estimates disrupted by conflict.",
            entities: ["Yemen"],
        },
        {
            text: "Measles coverage from household surveys.",
            entities: ["Nigeria"],
        },
    ],
    // DTP3
    1077436: [
        {
            text: "Coverage estimates disrupted by conflict.",
            entities: ["Yemen"],
        },
        {
            text: "DTP3 coverage from administrative records.",
            entities: ["Nigeria"],
        },
    ],
    // per-capita-electricity-fossil-nuclear-renewables (a stacked discrete
    // bar): fossil. Japan shares one text on all three indicators, France
    // differs on each, Sweden shares one on fossil and renewables, Germany
    // is annotated on nuclear only
    1295588: [
        {
            text: "Data covers fiscal years.",
            entities: ["Japan"],
        },
        {
            text: "Includes imported coal power.",
            entities: ["France"],
        },
        {
            text: "Combined heat and power plants included.",
            entities: ["Sweden"],
        },
    ],
    // nuclear
    1295587: [
        {
            text: "Data covers fiscal years.",
            entities: ["Japan"],
        },
        {
            text: "Several reactors were offline for maintenance.",
            entities: ["France"],
        },
        {
            text: "The last reactors closed in April 2023.",
            entities: ["Germany"],
        },
    ],
    // renewables
    1295590: [
        {
            text: "Data covers fiscal years.",
            entities: ["Japan"],
        },
        {
            text: "Hydropower output fell in a dry year.",
            entities: ["France"],
        },
        {
            text: "Combined heat and power plants included.",
            entities: ["Sweden"],
        },
    ],
    // distribution-of-population-across-income-thresholds-stacked-bar-30-only
    // (a crowded stacked discrete bar): below $30 a day
    1315271: [
        {
            text: "Survey measures consumption, not income.",
            entities: ["India"],
        },
        {
            text: "Below-threshold estimate interpolated between surveys.",
            entities: ["Mozambique"],
        },
    ],
    // above $30 a day
    1316191: [
        {
            text: "Survey measures consumption, not income.",
            entities: ["India"],
        },
        {
            text: "Above-threshold estimate from a single survey.",
            entities: ["Mozambique"],
        },
    ],
    // population-by-income-level (a stacked area, entity strategy).
    // Low-income and lower-middle-income share one text
    1294926: [
        {
            text: "Income groups follow the World Bank's 2024 classification.",
            entities: ["Low-income countries", "Lower-middle-income countries"],
        },
        {
            text: "Includes high-income territories without population estimates before 1990.",
            entities: ["High-income countries"],
        },
    ],
    // population-regions-with-projections (a stacked area with six regions)
    953899: [
        {
            text: "Includes Australia, New Zealand and the Pacific island states.",
            entities: ["Oceania"],
        },
        {
            text: "Russia is counted entirely in Europe, including its Asian territory.",
            entities: ["Europe"],
        },
    ],
    // co2-by-source (a stacked area, column strategy): coal
    1119887: [
        {
            text: "Coal estimates for recent years are preliminary.",
            entities: ["World"],
        },
        {
            text: "Coal use is reported by provincial statistics bureaus.",
            entities: ["China"],
        },
    ],
    // oil
    1119902: [
        {
            text: "Excludes international aviation and shipping bunkers.",
            entities: ["World"],
        },
        {
            text: "Includes oil burned in military operations.",
            entities: ["United States"],
        },
    ],
    // flaring, which has no World data before 1950
    1119891: [
        {
            text: "Flaring was not recorded separately before 1950.",
            entities: ["World"],
        },
    ],
    // gas
    1119896: [
        {
            text: "Includes flaring at shale gas wells.",
            entities: ["United States"],
        },
    ],
    // oecd-average-trust-in-governments (a time-range dumbbell)
    1195708: [
        {
            text: "Survey wording changed in 2015.",
            entities: ["United Kingdom"],
        },
        {
            text: "Sample excludes rural areas.",
            entities: ["Brazil"],
        },
    ],
    // area-burned-wildfires-by-type (a stacked bar, column strategy): forests
    1324979: [
        {
            text: "Includes plantation forests.",
            entities: ["World"],
        },
    ],
    // savannas
    1324980: [
        {
            text: "Savanna fires are mostly set on purpose to clear land for grazing.",
            entities: ["World"],
        },
    ],
    // annual-carbon-dioxide-emissions (a stacked bar, entity strategy with facet=none)
    1325228: [
        {
            text: "Estimates for 2024 are preliminary.",
            entities: ["World"],
        },
        {
            text: "Includes emissions from peatland fires, which smoulder for months.",
            entities: ["Indonesia"],
        },
    ],
    // government-vs-private-aid-by-donor (a stacked bar, column strategy): ODA
    1293345: [
        {
            text: "Members of the OECD Development Assistance Committee.",
            entities: ["DAC countries"],
        },
    ],
    // private grants
    1293376: [
        {
            text: "Grants from foundations, NGOs and private donors.",
            entities: ["DAC countries"],
        },
    ],
    // tree-cover-loss-by-dominant-driver (a stacked bar with seven columns).
    // Brazil's long annotations together don't fit the sidebar legend
    1104656: [
        {
            text: "Mining concessions are mapped from national cadastres, which are incomplete for informal and illegal mining in the Amazon. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    1104657: [
        {
            text: "Logging includes selective logging inside managed forests, which satellites detect less reliably than clear-cutting. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    1104658: [
        {
            text: "Other natural disturbances include storms, landslides, floods and droughts that kill trees without fire. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    1104659: [
        {
            text: "Settlements and infrastructure include roads, which open up surrounding forest to further clearing. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    1104660: [
        {
            text: "Permanent agriculture is mostly cattle pasture and soy, and accounts for most of the loss in the Amazon and the Cerrado. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    1104661: [
        {
            text: "Shifting cultivation is rare in Brazil compared to Central Africa, where it is the largest driver of loss. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    1104662: [
        {
            text: "Wildfire loss spikes in drought years such as 2016 and 2024, when fires set to clear land escaped into standing forest. Estimates for the latest year are revised as new satellite imagery is processed.",
            entities: ["Brazil"],
        },
    ],
    // covid-19-daily-tests-vs-daily-new-confirmed-cases (a scatter plot): cases on x
    954548: [
        {
            text: "Reporting was irregular during 2020.",
            entities: ["Brazil"],
        },
        {
            text: "Includes probable cases.",
            entities: ["Chile"],
        },
        // Point annotations
        {
            text: "Cases for this day include a reporting backlog.",
            entities: ["Brazil"],
            time: "2020-11-16",
        },
        // Brazil's last cases and tests values are on 11 March 2022, so tolerance resolves 14 March to 11 March
        {
            text: "Cases for this day are the last Brazil reported.",
            entities: ["Brazil"],
            time: "2022-03-11",
        },
        {
            // at the target day, which has no value, so it must not show
            text: "Cases for this day were not reported.",
            entities: ["Brazil"],
            time: "2022-03-14",
        },
    ],
    // tests on y
    984183: [
        {
            text: "Counts tests performed, not people tested.",
            entities: ["Argentina"],
        },
        {
            text: "Reporting was irregular during 2020.",
            entities: ["Brazil"],
        },
        {
            text: "Includes antigen tests.",
            entities: ["Chile"],
        },
        // Point annotations
        {
            text: "Tests for this day are from a single laboratory network.",
            entities: ["Brazil"],
            time: "2020-11-16",
        },
        {
            text: "Tests for this day are the last Brazil reported.",
            entities: ["Brazil"],
            time: "2022-03-11",
        },
        {
            // at the target day, which has no value, so it must not show
            text: "Tests for this day were not reported.",
            entities: ["Brazil"],
            time: "2022-03-14",
        },
        {
            // at the start of a trajectory from 8 August 2020 to 24 February 2021
            text: "Testing was expanded to private laboratories.",
            entities: ["Chile"],
            time: "2020-08-08",
        },
        {
            // in the middle of the trajectory, so it must not show
            text: "Tests for this day are revised upward.",
            entities: ["Chile"],
            time: "2020-11-16",
        },
        {
            // at the end of the trajectory, next to the entity annotation
            text: "Rapid tests are counted from this day.",
            entities: ["Chile"],
            time: "2021-02-24",
        },
    ],
    // Population (historical), the size of co2-emissions-vs-gdp and other scatter plots
    953903: [
        {
            text: "Excludes Hong Kong and Macao.",
            entities: ["China"],
        },
        // Point annotation, next to the entity annotation
        {
            text: "Population for this year is a UN estimate.",
            entities: ["China"],
            time: 2022,
        },
    ],
    // cost-space-launches-low-earth-orbit (a time scatter colored by launch vehicle class): cost on y
    1014833: [
        {
            text: "Prices are list prices for a new booster.",
            entities: ["Falcon 9"],
        },
        {
            text: "Retired in 2011.",
            entities: ["Space Shuttle"],
        },
        // Point annotations
        {
            text: "Cost is for the first reusable-booster launch.",
            entities: ["Falcon 9"],
            time: 2010,
        },
        {
            // at a year with no Falcon 9 launch, so it must not show
            text: "Cost excludes development.",
            entities: ["Falcon 9"],
            time: 2015,
        },
        {
            text: "Cost is for the first flight.",
            entities: ["Space Shuttle"],
            time: 1981,
        },
    ],
    // launch vehicle class
    1014832: [
        {
            text: "Retired in 2011.",
            entities: ["Space Shuttle"],
        },
        // Point annotations
        {
            text: "Class is set by payload mass to low Earth orbit.",
            entities: ["Falcon 9"],
            time: 2010,
        },
        {
            text: "Class is set by payload mass to low Earth orbit.",
            entities: ["Space Shuttle"],
            time: 1981,
        },
    ],
    // carbon-price-vs-share-emissions (a Marimekko colored by income group): carbon price on y
    1269941: [
        {
            text: "The national ETS covers the power sector only.",
            entities: ["China"],
        },
        {
            text: "Combines the federal fuel charge and provincial systems.",
            entities: ["Canada"],
        },
    ],
    // share of world CO₂ covered on x
    1269936: [
        {
            text: "The national ETS covers the power sector only.",
            entities: ["China"],
        },
        {
            text: "Combines the federal fuel charge and provincial systems.",
            entities: ["Canada"],
        },
    ],
    // World Bank income classification, the color
    1290376: [
        {
            text: "The national ETS covers the power sector only.",
            entities: ["China"],
        },
        {
            text: "Classified as lower-middle income since 2009.",
            entities: ["India"],
        },
    ],
}

export function applyDebugAnnotationOverride(
    metadata: OwidVariableWithSourceAndDimension
): void {
    const fakeAnnotations = FAKE_ANNOTATIONS_BY_VARIABLE_ID[metadata.id]
    if (!fakeAnnotations) return
    metadata.annotations = [...(metadata.annotations ?? []), ...fakeAnnotations]
}
