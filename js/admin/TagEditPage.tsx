import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, autorun, IReactionDisposer, reaction} from 'mobx'
import {Prompt, Redirect} from 'react-router-dom'
const timeago = require('timeago.js')()

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { BindString, NumericSelectField } from './Forms'
import DatasetList, { DatasetListItem } from './DatasetList'
import ChartList, { ChartListItem } from './ChartList'

interface TagPageData {
    id: number
    name: string
    specialType?: string
    updatedAt: string
    datasets: DatasetListItem[]
    charts: ChartListItem[]
    possibleParents: { id: number, name: string }[]
}

class TagEditable {
    @observable name: string = ""
    @observable parentId?: number

    constructor(json: TagPageData) {
        for (const key in this) {
            this[key] = (json as any)[key]
        }
    }
}

@observer
class TagEditor extends React.Component<{ tag: TagPageData }> {
    @observable newtag!: TagEditable
    @observable isDeleted: boolean = false

    // Store the original tag to determine when it is modified
    componentWillMount() { this.componentWillReceiveProps(this.props) }
    componentWillReceiveProps(nextProps: any) {
        this.newtag = new TagEditable(nextProps.tag)
        this.isDeleted = false
    }

    @computed get isModified(): boolean {
        return JSON.stringify(this.newtag) !== JSON.stringify(new TagEditable(this.props.tag))
    }

    async save() {
        const {tag} = this.props
        console.log(this.newtag)
        const json = await this.context.admin.requestJSON(`/api/tags/${tag.id}`, { tag: this.newtag }, "PUT")

        if (json.success) {
            runInAction(() => {
                Object.assign(this.props.tag, this.newtag)
                this.props.tag.updatedAt = (new Date()).toString()
            })
        }
    }

    async deleteTag() {
        const {tag} = this.props

        if (!window.confirm(`Really delete the tag ${tag.name}? This action cannot be undone!`))
            return

        const json = await this.context.admin.requestJSON(`/api/tags/${tag.id}/delete`, {}, "DELETE")

        if (json.success) {
            runInAction(() => this.isDeleted = true)
        }
    }

    @action.bound onChooseParent(parentId: number) {
        if (parentId === -1) {
            this.newtag.parentId = undefined
        } else {
            this.newtag.parentId = parentId
        }
    }

    render() {
        const {tag} = this.props
        const {newtag} = this

        return <main className="TagEditPage">
            <Prompt when={this.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>
            <section>
                <h1>Category: {tag.name}</h1>
                <p>Last updated {timeago.format(tag.updatedAt)}</p>
            </section>
            <section>
                <form onSubmit={e => { e.preventDefault(); this.save() }}>
                    <BindString field="name" store={newtag} label="Name" helpText="Category names should ideally be unique across the database and able to be understood without context"/>
                    <NumericSelectField label="Parent Category" value={newtag.parentId||-1} options={[-1].concat(tag.possibleParents.map(p => p.id))} optionLabels={["None"].concat(tag.possibleParents.map(p => p.name))} onValue={this.onChooseParent}/>
                    <input type="submit" className="btn btn-success" value="Update category"/> {tag.datasets.length === 0 && !tag.specialType && <button className="btn btn-danger" onClick={() => this.deleteTag()}>Delete category</button>}
                </form>
            </section>
            <section>
                <h3>Datasets</h3>
                <DatasetList datasets={tag.datasets}/>
            </section>

            <section>
                <h3>Charts</h3>
                <ChartList charts={tag.charts}/>
            </section>
            {this.isDeleted && <Redirect to={`/categories`}/>}
        </main>
    }
}

@observer
export default class TagEditPage extends React.Component<{ tagId: number }> {
    context!: { admin: Admin }
    @observable tag?: TagPageData

    render() {
        return <AdminLayout title={this.tag && this.tag.name}>
            {this.tag && <TagEditor tag={this.tag}/>}
        </AdminLayout>
    }

    async getData(tagId: number) {
        const json = await this.context.admin.getJSON(`/api/tags/${tagId}.json`)
        runInAction(() => {
            this.tag = json.tag as TagPageData
        })
    }

    componentDidMount() {
        this.getData(this.props.tagId)
    }
    componentWillReceiveProps(nextProps: any) {
        this.getData(nextProps.tagId)
    }
}
