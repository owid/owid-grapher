import { defaultTo } from "charts/Util"
import { VariableDisplaySettings } from "charts/VariableData"
import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: {
        id: number
        name: string
        unit: string
        shortUnit: string
        description: string
        display: VariableDisplaySettings

        datasetId: number
        datasetName: string
        datasetNamespace: string

        source: { id: number; name: string }
    }
}

export const VariableCountryPage = (props: VariableCountryPageProps) => {
    const { variable, country } = props

    const displayName = defaultTo(variable.display.name, variable.name)

    const pageTitle = `${country.name} / ${variable.name}`
    const script = `window.runVariableCountryPage(${JSON.stringify(props)})`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/search`}
                pageTitle={pageTitle}
                pageDesc="Search articles and charts on Our World in Data."
            />
            <body className="VariableCountryPage">
                <SiteHeader />
                <main>{variable.name}</main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
