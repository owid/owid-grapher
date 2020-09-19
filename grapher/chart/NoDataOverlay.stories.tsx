import * as React from "react"
import { NoDataOverlay } from "./NoDataOverlay"

export default {
    title: "NoDataOverlay",
    component: NoDataOverlay,
}

export const Default = () => {
    return (
        <div className="chart" style={{ width: 640, height: 480 }}>
            <NoDataOverlay
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
