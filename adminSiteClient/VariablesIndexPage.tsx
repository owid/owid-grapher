import { Component } from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    action,
    runInAction,
    reaction,
    IReactionDisposer,
    makeObservable,
} from "mobx"
import * as lodash from "lodash-es"

import { AdminLayout } from "./AdminLayout.js"
import { SearchField, FieldsRow } from "./Forms.js"
import { VariableList, VariableListItem } from "./VariableList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.js"
import urljoin from "url-join"
import { enumerable } from "@ourworldindata/types"

@observer
export class VariablesIndexPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    @observable @enumerable accessor variables: VariableListItem[] = []
    @observable @enumerable accessor maxVisibleRows = 50
    @observable @enumerable accessor numTotalRows: number | undefined =
        undefined
    @observable @enumerable accessor searchInput: string | undefined = undefined
    @observable @enumerable accessor highlightSearch: string | undefined =
        undefined

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this)
    }

    @computed get variablesToShow(): VariableListItem[] {
        return this.variables
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    override render() {
        const { variablesToShow, searchInput, numTotalRows } = this

        const highlight = (text: string) => {
            if (this.highlightSearch) {
                const html = text.replace(
                    new RegExp(
                        this.highlightSearch.replace(
                            /[-/\\^$*+?.()|[\]{}]/g,
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
                    <p>
                        Also try:{" "}
                        <a href={urljoin(ETL_WIZARD_URL, "indicator_search")}>
                            semantic indicator search
                        </a>
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
    override componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput || this.maxVisibleRows,
            lodash.debounce(() => this.getData(), 200)
        )
        void this.getData()
    }

    override componentWillUnmount() {
        this.dispose()
    }
}
