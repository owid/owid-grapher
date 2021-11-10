import { LegacyVariableConfig } from "../clientUtils/OwidVariable"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: LegacyVariableConfig
    baseUrl: string
}
