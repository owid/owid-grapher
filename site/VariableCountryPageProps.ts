import { LegacyVariableConfig } from "../grapher/core/LegacyVariableCode"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: LegacyVariableConfig
    baseUrl: string
}
