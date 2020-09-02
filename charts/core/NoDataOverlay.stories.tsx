import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { NoDataOverlay } from "./NoDataOverlay"
import { Bounds } from "charts/utils/Bounds"

export default {
    title: "NoDataOverlay",
    component: NoDataOverlay
}

export const Default = () => {
    return (
        <svg width={640} height={480}>
            <NoDataOverlay
                bounds={new Bounds(0, 0, 640, 480)}
                message="I wish I had some data"
                options={{
                    canChangeEntity: true,
                    canAddData: true,
                    isSelectingData: false,
                    entityType: "Pizza Types"
                }}
            />
        </svg>
    )
}
