enum CountryProfileProject {
    coronavirus = "coronavirus",
    co2 = "co2",
    energy = "energy"
}

export const countryProfileDefaultCountryPlaceholder =
    "{DEFAULT_COUNTRY_ENTITY_SELECT}"

interface CountryProfileProjectConfiguration {
    project: CountryProfileProject
    pageTitle: string
    landingPageSlug: string
}

export interface CountryProfileSpec extends CountryProfileProjectConfiguration {
    genericProfileSlug: string
    rootPath: string
}

const countryProfileProjectConfigurations: CountryProfileProjectConfiguration[] = [
    {
        project: CountryProfileProject.coronavirus,
        pageTitle: "Coronavirus Pandemic",
        landingPageSlug: "coronavirus"
    },
    {
        project: CountryProfileProject.co2,
        pageTitle: "CO2",
        landingPageSlug: "co2-and-other-greenhouse-gas-emissions"
    },
    {
        project: CountryProfileProject.energy,
        pageTitle: "Energy",
        landingPageSlug: "energy"
    }
]

export const countryProfileSpecs: CountryProfileSpec[] = countryProfileProjectConfigurations.map(
    config => {
        return {
            ...config,
            rootPath: `${config.project}/country`,
            genericProfileSlug: `${config.project}-country-profile`
        }
    }
)
