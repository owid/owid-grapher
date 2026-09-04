import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockCountryProfileSelector = {
    type: "country-profile-selector"
    value: {
        url?: string
        title?: string
        description?: string
        defaultCountries?: string
    }
}

/** @see [CountryProfileSelector.md](./CountryProfileSelector.md) */
export type EnrichedBlockCountryProfileSelector = {
    type: "country-profile-selector"
    url: string
    title?: string
    description?: string
    defaultCountries: string[]
} & EnrichedBlockWithParseErrors
