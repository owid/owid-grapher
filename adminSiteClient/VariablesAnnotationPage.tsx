import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    action,
    runInAction,
    reaction,
    IReactionDisposer,
} from "mobx"
import * as lodash from "lodash"

import { HotTable } from "@handsontable/react"
import { AdminLayout } from "./AdminLayout"
import { SearchField, FieldsRow } from "./Forms"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"

@observer
export class VariablesAnnotationPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        return (
            <AdminLayout title="Variables">
                <main className="VariablesAnnotationPage"></main>
            </AdminLayout>
        )
    }

    async getData() {
        // const { searchInput, maxVisibleRows } = this
        // const json = await this.context.admin.getJSON("/api/variables.json", {
        //     search: searchInput,
        //     limit: maxVisibleRows,
        // })
        // runInAction(() => {
        //     if (searchInput === this.searchInput) {
        //         // Make sure this response is current
        //         this.variables = json.variables
        //         this.numTotalRows = json.numTotalRows
        //         this.highlightSearch = searchInput
        //     }
        // })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        // this.dispose = reaction(
        //     () => this.searchInput || this.maxVisibleRows,
        //     lodash.debounce(() => this.getData(), 200)
        // )
        // this.getData()
    }

    componentWillUnmount() {
        //this.dispose()
    }
}
