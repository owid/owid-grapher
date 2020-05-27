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
        name: "Confirmed cases of COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            name: "confirmed cases",
            unit: "cases",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0,
            entityAnnotationsMap: `Spain: Note that on April 19 & May 25th the methodology has changed
Lithuania: Note that on April 28 the methodology has changed
Ecuador: Note that on May 8 the methodology has changed
United Kingdom: Note that on May 20 the methodology has changed`
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
        id: 142583,
        name: "Confirmed deaths due to COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            name: "confirmed deaths",
            unit: "deaths",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0,
            entityAnnotationsMap: `Benin: Note that on May 19 the methodology has changed
Spain: Note that on May 25 the methodology has changed`
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
        id: 1000001,
        name: "tests",
        unit: "",
        description: "",
        coverage: "",
        datasetId: "covid",
        shortUnit: "",
        display: {
            name: "tests",
            yearIsDay: true,
            numDecimalPlaces: 0,
            entityAnnotationsMap: `Argentina: tests performed
Australia: tests performed
Austria: tests performed
Bahrain: units unclear
Bangladesh: samples tested
Belarus: tests performed
Belgium: units unclear
Bolivia: people tested
Brazil: tests performed
Bulgaria: tests performed
Canada: people tested
Chile: tests performed
Colombia: samples tested
Costa Rica: people tested
Croatia: people tested
Cuba: tests performed
Czech Republic: tests performed
Denmark: people tested
Ecuador: units unclear
El Salvador: tests performed
Estonia: tests performed
Ethiopia: tests performed
Finland: samples tested
France: tests performed
Germany: tests performed
Ghana: people tested
Greece: tests performed
Hong Kong: tests performed
Hungary: tests performed
Iceland: samples tested
India: samples tested
Indonesia: people tested
Iran: tests performed
Ireland: units unclear
Israel: tests performed
Italy: tests performed
Japan: people tested
Kazakhstan: tests performed
Kenya: units unclear
Latvia: tests performed
Lithuania: samples tested
Luxembourg: people tested
Malaysia: people tested
Maldives: samples tested
Mexico: people tested
Morocco: people tested
Myanmar: samples tested
Nepal: people tested
Netherlands: people tested
New Zealand: tests performed
Nigeria: samples tested
Norway: people tested
Pakistan: tests performed
Panama: units unclear
Paraguay: samples tested
Peru: units unclear
Philippines: people tested
Poland: samples tested
Portugal: samples tested
Qatar: people tested
Romania: tests performed
Russia: tests performed
Rwanda: units unclear
Saudi Arabia: units unclear
Senegal: tests performed
Serbia: people tested
Singapore: people tested
Slovakia: tests performed
Slovenia: tests performed
South Africa: units unclear
South Korea: people tested
Spain: tests performed
Sweden: people tested
Switzerland: tests performed
Taiwan: tests performed
Thailand: samples tested
Tunisia: units unclear
Turkey: tests performed
Uganda: samples tested
Ukraine: units unclear
United Kingdom: people tested
United States: inconsistent units (COVID Tracking Project)
Uruguay: tests performed
Vietnam: units unclear
Zimbabwe: tests performed`
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
    days_since_five: {
        id: 99999,
        name: "Days since the total confirmed deaths of COVID-19 reached 5",
        unit: "",
        description: "",
        coverage: "",
        shortUnit: "",
        display: {
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
