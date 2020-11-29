import { LegacyVariableDisplayConfigInterface } from "coreTable/LegacyVariableDisplayConfigInterface"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: LegacyVariableDisplayConfigInterface
    baseUrl: string
}
