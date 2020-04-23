import { OwidVariable } from "charts/owidData/OwidVariable"

// Normally all variables come from the WP backend. In this attempt I try and generate variables client side.
// This map contains the meta data for these generated variables which they then can extend. There's the obvious
// issue that this file can get out of data with the WP backend. In addition, this approach is fine for simple
// transformations, but for generating slightly more complex variables like rolling windows with certain parameters,
// which are easy with Pandas, become not as simple if we have to roll our own data transformation library.
// We may want to revert to a Chart Builder that cannot generate variables on the fly.
export const variablePartials: { [name: string]: Partial<OwidVariable> } = {
    cases: {
        id: 142581,
        name: "Daily new confirmed cases of COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            name: "Daily confirmed cases",
            unit: "cases",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 18th April, 11:15 (London time)",
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
        id: 142583,
        name: "Total confirmed deaths due to COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            unit: "deaths",
            zeroDay: "2020-01-21",
            yearIsDay: true
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 18th April, 11:15 (London time)",
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
        id: 1000001,
        name: "tests",
        unit: "",
        description: "",
        coverage: "",
        datasetId: "covid",
        shortUnit: "",
        display: {
            name: "Tests",
            yearIsDay: true,
            entityAnnotationsMap:
                "Argentina: tests performed\nAustralia: units unclear\nAustria: units unclear\nBahrain: units unclear\nBangladesh: samples tested\nBelgium: tests performed\nBolivia: cases tested\nCanada: people tested\nChile: tests performed\nColombia: samples processed\nCosta Rica: people tested\nCzech Republic: tests performed\nDenmark: people tested\nEcuador: samples tested\nEl Salvador: tests performed\nEstonia: units unclear\nEthiopia: tests performed\nFinland: tests sampled\nFrance: units unclear\nGermany: tests performed\nGhana: people tested\nGreece: people tested\nHong Kong: tests performed\nHungary: tests performed\nIceland: units unclear\nIndia: samples tested\nIndonesia: units unclear\nIreland: units unclear\nIsrael: units unclear\nItaly: tests performed\nJapan: people tested\nLatvia: tests performed\nLithuania: samples analyzed\nLuxembourg: tests analysed\nMalaysia: cases tested\nMexico: cases tested\nNetherlands: people tested\nNew Zealand: units unclear\nNorway: people tested\nPakistan: tests performed\nPanama: units unclear\nParaguay: samples tested\nPeru: units unclear\nPhilippines: people tested\nPoland: samples tested\nPortugal: cases tested\nRomania: tests performed\nRussia: tests performed\nSenegal: tests performed\nSerbia: people tested\nSingapore: people tested\nSlovakia: analysed samples\nSlovenia: tests performed\nSouth Africa: units unclear\nSouth Korea: cases tested\nSpain: tests performed\nSweden: people tested\nSwitzerland: tests performed\nTaiwan: tests performed\nThailand: people tested\nTunisia: units unclear\nTurkey: units unclear\nUnited Kingdom: people tested\nUnited States: inconsistent units (COVID Tracking Project)\nUruguay: units unclear\nVietnam: units unclear\n"
        },
        datasetName: "COVID testing time series data (17 April 18:00)",
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
    days_since_five: {
        id: 99999,
        name: "Days since the total confirmed deaths of COVID-19 reached 5",
        unit: "",
        description: "",
        coverage: "",
        shortUnit: "",
        display: { zeroDay: "2020-01-21", yearIsDay: true },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 20th April, 11:30 (London time)",
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
        id: 123,
        name: "Countries Continents",
        unit: "",
        description: "Countries and their associated continents.",
        coverage: "",
        shortUnit: "",
        display: {},
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
