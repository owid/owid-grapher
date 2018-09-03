import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction} from 'mobx'
import {Prompt} from 'react-router-dom'
const timeago = require('timeago.js')()

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { BindString } from './Forms'
import VariableList, { VariableListItem } from './VariableList'

interface TagPageData {
    id: number
    name: string
    updatedAt: string
}

class TagEditable {
    @observable name: string = ""

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
    componentWillMount() { this.componentWillReceiveProps() }
    componentWillReceiveProps() {
        this.newtag = new TagEditable(this.props.tag)
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

    render() {
        const {tag} = this.props
        const {newtag} = this

        return <main className="TagEditPage">
            <Prompt when={this.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>
            <section>
                <h1>Tag: {tag.name}</h1>
                <p>Last updated {timeago.format(tag.updatedAt)}</p>
            </section>
            <section>
                <form onSubmit={e => { e.preventDefault(); this.save() }}>
                    <BindString field="name" store={newtag} label="Name"/>
                    <input type="submit" className="btn btn-success" value="Update tag"/>
                </form>
            </section>
            {/*<section>
                <h3>Variables</h3>
                <VariableList variables={tag.variables}/>
            </section>*/}
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

    async getData() {
        const json = await this.context.admin.getJSON(`/api/tags/${this.props.tagId}.json`)
        runInAction(() => {
            this.tag = json.tag as TagPageData
        })
    }

    componentDidMount() { this.componentWillReceiveProps() }
    componentWillReceiveProps() {
        this.getData()
    }
}
