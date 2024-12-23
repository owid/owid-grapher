import * as React from "react"
import { NoDataModal } from "./NoDataModal"

export default {
    title: "NoDataModal",
    component: NoDataModal,
}

export const WithAddDataButtons = (): React.ReactElement => {
    return (
        <div className="chart" style={{ width: 640, height: 480 }}>
            <svg>
                <NoDataModal
                    message="You have no data, but this is only a test"
                    manager={{
                        canChangeEntity: true,
                        canAddEntities: true,
                        entityType: "Country",
                    }}
                />
            </svg>
        </div>
    )
}
