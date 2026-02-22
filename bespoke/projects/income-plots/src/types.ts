export interface IntDollarConversionEntry {
    country: string
    country_code: string
    ppp_year: number
    ppp_factor: number
    ppp_source: "pip" | "wdi"
    cpi_factor: number
    conversion_factor: number
    conversion_factor_year: number
    currency_code: string
    currency_name: string
}

export type IntDollarConversions = IntDollarConversionEntry[]

export interface DetectCountryResponse {
    country?: {
        code?: string
        name?: string
        short_code?: string
        slug?: string
        regions?: string[]
    }
}
