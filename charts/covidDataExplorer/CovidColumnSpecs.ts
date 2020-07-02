import { ColumnSpec } from "charts/owidData/OwidTable"

// Normally all variables come from the WP backend. In this attempt I try and generate variables client side.
// This map contains the meta data for these generated variables which they then can extend. There's the obvious
// issue that this file can get out of data with the WP backend. In addition, this approach is fine for simple
// transformations, but for generating slightly more complex variables like rolling windows with certain parameters,
// which are easy with Pandas, become not as simple if we have to roll our own data transformation library.
// We may want to revert to a Chart Builder that cannot generate variables on the fly.
export const columnSpecs: { [name: string]: ColumnSpec } = {
    positive_test_rate: {
        owidVariableId: 142721,
        isDailyMeasurement: true,
        slug: "cumulative_positivity_rate",
        name: "cumulative_positivity_rate",
        annotationsColumnSlug: "tests_units",
        unit: "",
        description:
            "The number of confirmed cases divided by the number of tests, expressed as a percentage. Tests may refer to the number of tests performed or the number of people tested – depending on which is reported by the particular country.",
        coverage: "",
        display: {
            name: "Cumulative positivity rate",
            unit: "%",
            shortUnit: "%",
            yearIsDay: true,
            conversionFactor: 100
        },
        datasetName: "COVID testing time series data",
        source: {
            id: 17805,
            name: "Official data collated by Our World in Data",
            dataPublishedBy:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            dataPublisherSource:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            link:
                "ourworldindata.org/covid-testing#source-information-country-by-country",
            retrievedDate: "",
            additionalInfo:
                "Data on COVID-19 testing. Comparisons between countries are compromised for several reasons.\n\nYou can download the full dataset, alongside detailed source descriptions here: https://github.com/owid/covid-19-data/tree/master/public/data/"
        }
    },
    tests_per_case: {
        owidVariableId: 142754,
        isDailyMeasurement: true,
        slug: "short_term_tests_per_case",
        name: "short_term_tests_per_case",
        annotationsColumnSlug: "tests_units",
        unit: "",
        description:
            "The number of tests divided by the number of confirmed cases. Not all countries report testing data on a daily basis.",
        coverage: "",
        display: {
            name: "Tests per confirmed case – daily",
            unit: "tests per confirmed case",
            yearIsDay: true
        },
        datasetName: "COVID testing time series data",
        source: {
            id: 17805,
            name: "Official data collated by Our World in Data",
            dataPublishedBy:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            dataPublisherSource:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            link:
                "ourworldindata.org/covid-testing#source-information-country-by-country",
            retrievedDate: "",
            additionalInfo:
                "Data on COVID-19 testing. Comparisons between countries are compromised for several reasons.\n\nYou can download the full dataset, alongside detailed source descriptions here: https://github.com/owid/covid-19-data/tree/master/public/data/"
        }
    },
    case_fatality_rate: {
        slug: "case_fatality_rate",
        owidVariableId: 142600,
        isDailyMeasurement: true,
        name:
            "Case fatality rate of COVID-19 (%) (Only observations with ≥100 cases)",
        unit: "",
        description: `The Case Fatality Rate (CFR) is the ratio between confirmed deaths and confirmed cases. During an outbreak of a pandemic the CFR is a poor measure of the mortality risk of the disease. We explain this in detail at OurWorldInData.org/Coronavirus`,
        coverage: "",
        display: { unit: "%", zeroDay: "2020-01-21", yearIsDay: true },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 3rd June, 11:00 (London time)",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link:
                "https://github.com/owid/covid-19-data/tree/master/public/data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    cases: {
        slug: "cases",
        owidVariableId: 142581,
        isDailyMeasurement: true,
        name: "Confirmed cases of COVID-19",
        unit: "",
        description: `The number of confirmed cases is lower than the number of actual cases; the main reason for that is limited testing.`,
        coverage: "",
        display: {
            name: "confirmed cases",
            unit: "cases",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name: "European CDC – Situation Update Worldwide",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    deaths: {
        slug: "deaths",
        owidVariableId: 142583,
        isDailyMeasurement: true,
        name: "Confirmed deaths due to COVID-19",
        unit: "",
        description: `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`,
        coverage: "",
        display: {
            name: "confirmed deaths",
            unit: "deaths",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name: "European CDC – Situation Update Worldwide",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    tests: {
        slug: "tests",
        owidVariableId: 142601,
        isDailyMeasurement: true,
        name: "tests",
        unit: "",
        description: "",
        coverage: "",
        annotationsColumnSlug: "tests_units",
        datasetId: "covid",
        shortUnit: "",
        display: {
            name: "tests",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID testing time series data",
        source: {
            id: 17805,
            name: "Official data collated by Our World in Data",
            dataPublishedBy:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            dataPublisherSource:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            link:
                "ourworldindata.org/covid-testing#source-information-country-by-country",
            retrievedDate: "",
            additionalInfo:
                "Data on COVID-19 testing. Comparisons between countries are compromised for several reasons.\n\nYou can download the full dataset, alongside detailed source descriptions here: https://github.com/owid/covid-19-data/tree/master/public/data/testing"
        }
    },
    days_since: {
        slug: "days_since",
        owidVariableId: 99999,
        isDailyMeasurement: true,
        name: "",
        unit: "",
        description: "",
        coverage: "",
        shortUnit: "",
        display: {
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0,
            includeInTable: false
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name: "European CDC – Situation Update Worldwide",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    continents: {
        owidVariableId: 123,
        slug: "continent",
        name: "Countries Continents",
        unit: "",
        description: "Countries and their associated continents.",
        coverage: "",
        shortUnit: "",
        display: { includeInTable: false },
        datasetName: "Countries Continents",
        source: {
            id: 44,
            name: "Our World In Data",
            dataPublishedBy: "",
            dataPublisherSource: "",
            link: "",
            retrievedDate: "",
            additionalInfo: ""
        }
    }
}

// todo: add annotations back
// `Benin: Note that on May 19 the methodology has changed
// Spain: Note that on May 25 the methodology has changed
// United Kingdom: Note that on June 1 the methodology has changed
// Panama: Note that on June 3 the methodology has changed
// European Union: Some EU countries changed methodology. See country-by-country series.
// India: Note that on June 17 earlier deaths were added to the total.`

export const trajectoryOptions = {
    deaths: {
        total: {
            title: "Days since the 5th total confirmed death",
            threshold: 5,
            id: 4561
        },
        daily: {
            title: "Days since 5 daily new deaths first reported",
            threshold: 5,
            id: 4562
        },
        perCapita: {
            title: "Days since total confirmed deaths reached 0.1 per million",
            threshold: 0.1,
            id: 4563
        }
    },
    cases: {
        total: {
            title: "Days since the 100th confirmed case",
            threshold: 100,
            id: 4564
        },
        daily: {
            title: "Days since confirmed cases first reached 30 per day",
            threshold: 30,
            id: 4565
        },
        perCapita: {
            title:
                "Days since the total confirmed cases per million people reached 1",
            threshold: 1,
            id: 4566
        }
    }
}
