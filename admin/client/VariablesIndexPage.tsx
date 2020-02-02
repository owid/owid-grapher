import * as _ from "lodash"
import {
    action,
    computed,
    IReactionDisposer,
    observable,
    reaction,
    runInAction
} from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { AdminLayout } from "./AdminLayout"
import { FieldsRow, SearchField } from "./Forms"
import { VariableList, VariableListItem } from "./VariableList"

@observer
export class VariablesIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable variables: VariableListItem[] = []
    @observable maxVisibleRows = 50
    @observable numTotalRows?: number
    @observable searchInput?: string
    @observable highlightSearch?: string

    @computed get variablesToShow(): VariableListItem[] {
        return this.variables
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    render() {
        const {
            variablesToShow,
            searchInput,
            highlightSearch,
            numTotalRows
        } = this

        const highlight = (text: string) => {
            if (this.highlightSearch) {
                const html = text.replace(
                    new RegExp(
                        this.highlightSearch.replace(
                            /[-\/\\^$*+?.()|[\]{}]/g,
                            "\\$&"
                        ),
                        "i"
                    ),
                    s => `<b>${s}</b>`
                )
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

        return (
            <AdminLayout title="Variables">
                <main className="DatasetsIndexPage">
                    <FieldsRow>
                        <span>
                            Showing {variablesToShow.length} of {numTotalRows}{" "}
                            variables
                        </span>
                        <SearchField
                            placeholder="Search all variables..."
                            value={searchInput}
                            onValue={action(
                                (v: string) => (this.searchInput = v)
                            )}
                            autofocus
                        />
                    </FieldsRow>
                    <VariableList
                        variables={variablesToShow}
                        searchHighlight={highlight}
                    />
                    {!searchInput && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more variables...
                        </button>
                    )}
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { searchInput, maxVisibleRows } = this
        const json = await this.context.admin.getJSON("/api/variables.json", {
            search: searchInput,
            limit: maxVisibleRows
        })
        runInAction(() => {
            if (searchInput === this.searchInput) {
                // Make sure this response is current
                this.variables = json.variables
                this.numTotalRows = json.numTotalRows
                this.highlightSearch = searchInput
            }
        })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput || this.maxVisibleRows,
            _.debounce(() => this.getData(), 200)
        )
        this.getData()
    }

    componentWillUnmount() {
        this.dispose()
    }
}
