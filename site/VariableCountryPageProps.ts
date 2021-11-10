import { OwidVariableConfig } from "../clientUtils/OwidVariable"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: OwidVariableConfig
    baseUrl: string
}
