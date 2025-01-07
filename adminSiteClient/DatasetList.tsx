import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import * as lodash from "lodash"
import { bind } from "decko"

import { Link } from "./Link.js"
import { DbChartTagJoin } from "@ourworldindata/utils"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"

export interface DatasetListItem {
    id: number
    name: string
    shortName: string
    namespace: string
    description: string
    dataEditedAt: Date
    dataEditedByUserName: string
    metadataEditedAt: Date
    metadataEditedByUserName: string
    tags: DbChartTagJoin[]
    isPrivate: boolean
    nonRedistributable: boolean
    version: string
    numCharts: number
}

@observer
class DatasetRow extends React.Component<{
    dataset: DatasetListItem
    availableTags: DbChartTagJoin[]
    searchHighlight?: (text: string) => string | React.ReactElement
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    async saveTags(tags: DbChartTagJoin[]) {
        const { dataset } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/setTags`,
            { tagIds: tags.map((t) => t.id) },
            "POST"
        )
        if (json.success) {
            dataset.tags = tags
        }
    }

    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        void this.saveTags(tags)
    }

    render() {
        const { dataset, searchHighlight, availableTags } = this.props

        const highlight = searchHighlight || lodash.identity

        return (
            <tr>
                <td>
                    {dataset.nonRedistributable ? (
                        <span className="text-secondary">
                            Non-redistributable:{" "}
                        </span>
                    ) : dataset.isPrivate ? (
                        <span className="text-secondary">Unpublished: </span>
                    ) : (
                        ""
                    )}
                    <Link to={`/datasets/${dataset.id}`}>
                        {highlight(dataset.name)}
                    </Link>
                </td>
                <td>{dataset.namespace}</td>
                <td>{highlight(dataset.shortName)}</td>
                <td>{dataset.version}</td>
                <td>{dataset.numCharts}</td>
                <td>
                    <Timeago
                        time={dataset.dataEditedAt}
                        by={highlight(dataset.dataEditedByUserName)}
                    />
                </td>
                <td>{highlight(dataset.description)}</td>
                <td>
                    <EditableTags
                        tags={dataset.tags}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                        disabled={dataset.namespace !== "owid"}
                    />
                </td>
            </tr>
        )
    }
}

@observer
export class DatasetList extends React.Component<{
    datasets: DatasetListItem[]
    searchHighlight?: (text: string) => string | React.ReactElement
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable availableTags: DbChartTagJoin[] = []

    @bind async getTags() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        this.availableTags = json.tags
    }

    componentDidMount() {
        void this.getTags()
    }

    render() {
        const { props } = this
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Dataset</th>
                        <th>Namespace</th>
                        <th>Short name</th>
                        <th>Version</th>
                        <th>Number of charts</th>
                        <th>Uploaded</th>
                        <th>Notes</th>
                        <th>Tags</th>
                    </tr>
                </thead>
                <tbody>
                    {props.datasets.map((dataset) => (
                        <DatasetRow
                            dataset={dataset}
                            availableTags={this.availableTags}
                            key={dataset.id}
                            searchHighlight={props.searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}
