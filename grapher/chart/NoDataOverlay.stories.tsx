import * as React from "react"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
import { NoDataOverlay } from "./NoDataOverlay"
import { Bounds } from "grapher/utils/Bounds"

export default {
    title: "NoDataOverlay",
    component: NoDataOverlay,
}

export const Default = () => {
    return (
        <div className="chart" style={{ width: 640, height: 480 }}>
            <NoDataOverlay
                bounds={new Bounds(0, 0, 640, 480)}
                message="You have no data, but this is only a test"
                options={{
                    canChangeEntity: true,
                    canAddData: true,
                    isSelectingData: false,
                    entityType: "Country",
                    standalone: true,
                }}
            />
        </div>
    )
}
