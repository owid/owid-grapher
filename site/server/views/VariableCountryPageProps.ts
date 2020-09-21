import { LegacyVariableConfig } from "coreTable/LegacyVariableCode"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: LegacyVariableConfig
}
