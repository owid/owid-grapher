import React from "react"
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

import { AdminLayout } from "./AdminLayout.js"
import { SearchField, FieldsRow } from "./Forms.js"
import { VariableList, VariableListItem } from "./VariableList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

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
        const { variablesToShow, searchInput, numTotalRows } = this

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
                    (s) => `<b>${s}</b>`
                )
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

        return (
            <AdminLayout title="Indicators">
                <main className="DatasetsIndexPage">
                    <FieldsRow>
                        <span>
                            Showing {variablesToShow.length} of {numTotalRows}{" "}
                            indicators
                        </span>
                        <SearchField
                            placeholder="e.g. ^population before:2023 -wdi"
                            value={searchInput}
                            onValue={action(
                                (v: string) => (this.searchInput = v)
                            )}
                            autofocus
                        />
                    </FieldsRow>
                    <p>
                        <em>
                            You can use regular expressions and the following
                            fields:
                        </em>{" "}
                        <code>name:</code>, <code>path:</code>,{" "}
                        <code>namespace:</code>, <code>version:</code>,{" "}
                        <code>dataset:</code>, <code>table:</code>,{" "}
                        <code>short:</code>, <code>before:</code>,{" "}
                        <code>after:</code>, <code>is:public</code>,{" "}
                        <code>is:private</code>
                    </p>
                    <VariableList
                        variables={variablesToShow}
                        fields={[
                            "namespace",
                            "version",
                            "dataset",
                            "table",
                            "shortName",
                            "uploadedAt",
                        ]}
                        searchHighlight={highlight}
                    />
                    {!searchInput && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more indicators...
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
            limit: maxVisibleRows,
        })
        runInAction(() => {
            if (searchInput === this.searchInput) {
                // Make sure this response is current
                this.variables = json.variables
                this.numTotalRows = json.numTotalRows
                // NOTE: search highlighting is less relevant with fielded and regex search
                this.highlightSearch = searchInput
            }
        })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput || this.maxVisibleRows,
            lodash.debounce(() => this.getData(), 200)
        )
        void this.getData()
    }

    componentWillUnmount() {
        this.dispose()
    }
}
