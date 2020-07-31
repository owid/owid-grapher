import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "./AdminLayout"
import { ChartSwitcher } from "charts/ChartSwitcher"
import { AdminAppContextType, AdminAppContext } from "./AdminAppContext"

@observer
export class ExplorerCreatePage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    componentDidMount() {
        this.context.admin.showLoadingIndicator = false
    }

    componentWillUnmount() {
        this.context.admin.showLoadingIndicator = true
    }

    render() {
        return (
            <AdminLayout title="Create Explorer">
                <main>
                    <ChartSwitcher />
                </main>
            </AdminLayout>
        )
    }
}
