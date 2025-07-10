import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import { observable, action, runInAction } from "mobx"

import { AdminLayout } from "./AdminLayout.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

@observer
export class ChartIndexPage extends ObservedReactComponent {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable charts: ChartListItem[] = []

    render() {
        const { charts } = this

        return (
            <AdminLayout title="Charts">
                <main className="ChartIndexPage">
                    <ChartList
                        charts={charts}
                        autofocusSearchInput
                        onDelete={action((c: ChartListItem) =>
                            this.charts.splice(this.charts.indexOf(c), 1)
                        )}
                    />
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { admin } = this.context
        const json = await admin.getJSON("/api/charts.json")
        runInAction(() => {
            this.charts = json.charts
        })
    }

    componentDidMount() {
        void this.getData()
    }
}
