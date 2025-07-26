import { Component } from "react"
import { observer } from "mobx-react"
import { observable, action, runInAction, makeObservable } from "mobx"

import { AdminLayout } from "./AdminLayout.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

@observer
export class ChartIndexPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    @observable charts: ChartListItem[] = []

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this)
    }

    override render() {
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

    override componentDidMount() {
        void this.getData()
    }
}
