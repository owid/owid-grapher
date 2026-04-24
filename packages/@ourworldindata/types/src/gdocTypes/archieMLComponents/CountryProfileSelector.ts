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

/**
 * A country selector UI used on country-profile pages to let readers
 * jump to a specific country's profile. Undocumented in the author
 * reference.
 *
 * @owid-component country-profile-selector
 * @owid-title Country Profile Selector
 */
export type EnrichedBlockCountryProfileSelector = {
    type: "country-profile-selector"
    url: string
    title?: string
    description?: string
    defaultCountries: string[]
} & EnrichedBlockWithParseErrors
