import * as settings from "settings"
import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { VariableDisplaySettings } from "charts/Variable"
import { defaultTo } from "charts/Util"

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
