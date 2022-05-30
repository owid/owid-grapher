import React from "react"
import { observer } from "mobx-react"
import { AdminLayout } from "./AdminLayout.js"
@observer
export class DetailsOnDemandPage extends React.Component {
    render() {
        return (
            <AdminLayout title="Details on Demand">
                <p>hello</p>
            </AdminLayout>
        )
    }
}
