import { OwidVariableWithDataAndSource } from "../clientUtils/OwidVariable"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: OwidVariableWithDataAndSource
    baseUrl: string
}
