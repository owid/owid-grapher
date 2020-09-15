import * as React from "react"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
import { basicGdpGrapher } from "grapher/test/samples"
import { GrapherView } from "grapher/core/GrapherView"
import { MapTab } from "./MapTab"
import { Bounds } from "grapher/utils/Bounds"

export default {
    title: "MapTab",
    component: MapTab,
}

export const Default = () => {
    const grapher = basicGdpGrapher()
    grapher.hasMapTab = true
    grapher.tab = "map"
    const bounds = new Bounds(0, 0, 600, 600)

    // Todo: should not need GrapherView?
    return <GrapherView grapher={grapher} bounds={bounds} />
}
