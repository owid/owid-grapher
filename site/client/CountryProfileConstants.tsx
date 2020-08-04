import {
    covidCountryProfileSlug,
    covidLandingSlug,
    covidCountryProfileRootPath
} from "site/server/covid/CovidConstants"

export type CountryProfileProject = "coronavirus" | "co2"

export interface CountryProfileSpec {
    project: CountryProfileProject
    pageTitle: string
    genericProfileSlug: string
    landingPageSlug: string
    selector: string
    rootPath: string
}

export const co2CountryProfileRootPath = "co2/country"
export const co2CountryProfilePath = "/co2-country-profile"

export const countryProfileSpecs: Map<
    CountryProfileProject,
    CountryProfileSpec
> = new Map([
    [
        "coronavirus",
        {
            project: "coronavirus",
            pageTitle: "Coronavirus Pandemic",
            genericProfileSlug: covidCountryProfileSlug,
            landingPageSlug: covidLandingSlug,
            selector: ".wp-block-covid-search-country",
            rootPath: covidCountryProfileRootPath
        }
    ],
    [
        "co2",
        {
            project: "co2",
            pageTitle: "CO2",
            genericProfileSlug: "co2-country-profile",
            landingPageSlug: "co2-and-greenhouse-gas-emissions-landing-page",
            selector: ".wp-block-co2-search-country",
            rootPath: co2CountryProfileRootPath
        }
    ]
])
