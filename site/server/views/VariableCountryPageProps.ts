import { LegacyVariableConfig } from "owidTable/LegacyVariableCode"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: LegacyVariableConfig
}
