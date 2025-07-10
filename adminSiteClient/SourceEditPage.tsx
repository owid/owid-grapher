import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import { observable, computed, runInAction } from "mobx"
import { Prompt } from "react-router-dom"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { BindString, Timeago } from "./Forms.js"
import { VariableList, VariableListItem } from "./VariableList.js"

interface SourcePageData {
    id: number
    name: string
    updatedAt: string
    namespace: string
    description: {
        dataPublishedBy?: string
        dataPublisherSource?: string
        link?: string
        retrievedDate?: string
        additionalInfo?: string
    }
    variables: VariableListItem[]
}

class SourceEditable {
    @observable name: string = ""
    @observable description = {
        dataPublishedBy: undefined,
        dataPublisherSource: undefined,
        link: undefined,
        retrievedDate: undefined,
        additionalInfo: undefined,
    }

    constructor(json: SourcePageData) {
        for (const key in this) {
            if (key === "description")
                Object.assign(this.description, json.description)
            else if (key in json) this[key] = (json as any)[key]
        }
    }
}

@observer
class SourceEditor extends ObservedReactComponent<{ source: SourcePageData }> {
    @observable newSource!: SourceEditable
    @observable isDeleted: boolean = false

    // Store the original source to determine when it is modified
    UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.newSource = new SourceEditable(this.props.source)
        this.isDeleted = false
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newSource) !==
            JSON.stringify(new SourceEditable(this.props.source))
        )
    }

    async save() {
        const { source } = this.props
        console.log(this.newSource)
        const json = await this.context.admin.requestJSON(
            `/api/sources/${source.id}`,
            { source: this.newSource },
            "PUT"
        )

        if (json.success) {
            Object.assign(this.props.source, this.newSource)
        }
    }

    render() {
        const { source } = this.props
        const { newSource } = this
        const isBulkImport = source.namespace !== "owid"

        return (
            <main className="SourceEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <section>
                    <h1>Source: {source.name}</h1>
                    <p>
                        Last updated <Timeago time={source.updatedAt} />
                    </p>
                </section>
                <section>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            void this.save()
                        }}
                    >
                        {isBulkImport && (
                            <p>
                                This source is associated with a bulk import, so
                                we can't change it manually.
                            </p>
                        )}
                        <BindString
                            field="name"
                            store={newSource}
                            label="Name"
                            disabled={true}
                        />
                        <BindString
                            field="dataPublishedBy"
                            store={newSource.description}
                            label="Data published by"
                            disabled={true}
                        />
                        <BindString
                            field="dataPublisherSource"
                            store={newSource.description}
                            label="Data publisher's source"
                            disabled={true}
                        />
                        <BindString
                            field="link"
                            store={newSource.description}
                            label="Link"
                            disabled={true}
                        />
                        <BindString
                            field="retrievedDate"
                            store={newSource.description}
                            label="Retrieved"
                            disabled={true}
                        />
                        <BindString
                            field="additionalInfo"
                            store={newSource.description}
                            label="Additional information"
                            textarea
                            disabled={true}
                        />
                        <input
                            type="submit"
                            className="btn btn-success"
                            value="Update source"
                            disabled={true}
                        />
                    </form>
                </section>
                <section>
                    <h3>Indicators</h3>
                    <VariableList variables={source.variables} fields={[]} />
                </section>
            </main>
        )
    }
}

@observer
export class SourceEditPage extends ObservedReactComponent<{
    sourceId: number
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable source?: SourcePageData

    render() {
        return (
            <AdminLayout title={this.source && this.source.name}>
                {this.source && <SourceEditor source={this.source} />}
            </AdminLayout>
        )
    }

    async getData() {
        const json = await this.context.admin.getJSON(
            `/api/sources/${this.props.sourceId}.json`
        )
        runInAction(() => {
            this.source = json.source as SourcePageData
        })
    }

    componentDidMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        void this.getData()
    }
}
