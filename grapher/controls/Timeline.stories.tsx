import * as React from "react"

import { TimelineControl } from "grapher/controls/TimelineControl"
import { basicGdpGrapher } from "grapher/test/samples"

export default {
    title: "TimelineControl",
    component: TimelineControl,
}

export const Default = () => {
    const grapher = basicGdpGrapher()
    return <TimelineControl grapher={grapher} />
}
