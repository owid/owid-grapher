import { OwidVariableWithDataAndSource } from "../clientUtils/OwidVariable.js"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: OwidVariableWithDataAndSource
    baseUrl: string
}
