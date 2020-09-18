import * as React from "react"
import { basicGdpGrapher } from "grapher/test/samples"
import { DataTable } from "./DataTable"

export default {
    title: "DataTable",
    component: DataTable,
}

export const Default = () => {
    const grapher = basicGdpGrapher()
    return <DataTable grapher={grapher} />
}

export const WithTimeTolerance = () => {
    const grapher = basicGdpGrapher()
    grapher.timeDomain = [2009, 2017]
    // Todo: how can I get this to show a closest time popup?
    return <DataTable grapher={grapher} />
}
