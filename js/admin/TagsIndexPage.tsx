import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction} from 'mobx'
import * as _ from 'lodash'
import { Redirect } from 'react-router-dom'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { FieldsRow, Modal, TextField } from './Forms'
import TagBadge, { Tag } from './TagBadge'

interface TagListItem {
    id: number
    name: string
    parentId: number
    specialType?: string
}

@observer
class AddTagModal extends React.Component<{ parentId?: number, onClose: () => void }> {
    context!: { admin: Admin }

    @observable tagName: string = ""
    @observable newTagId?: number

    @computed get tag() {
        if (!this.tagName) return undefined

        return {
            parentId: this.props.parentId,
            name: this.tagName
        }
    }

    async submit() {
        if (this.tag) {
            const resp = await this.context.admin.requestJSON("/api/tags/new", { tag: this.tag }, "POST")
            if (resp.success) {
                this.newTagId = resp.tagId
            }
        }
    }

    @action.bound onTagName(tagName: string) {
        this.tagName = tagName
    }

    render() {
        return <Modal onClose={this.props.onClose}>
            <form onSubmit={e => { e.preventDefault(); this.submit() } }>
                <div className="modal-header">
                    <h5 className="modal-title">Add category</h5>
                </div>
                <div className="modal-body">
                    <TextField label="Category Name" value={this.tagName} onValue={this.onTagName} autofocus required/>
                </div>
                <div className="modal-footer">
                    <input type="submit" className="btn btn-primary">Send invite</input>
                </div>
            </form>
            {this.newTagId !== undefined && <Redirect to={`/categories/${this.newTagId}`}/>}
        </Modal>
    }
}

@observer
export default class TagsIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable categories: TagListItem[] = []
    @observable isAddingTag: boolean = false
    @observable addTagParentId?: number

    @computed get categoriesById(): _.Dictionary<TagListItem> {
        return _.keyBy(this.categories, t => t.id)
    }

    @computed get parentCategories(): { id: number, name: string, specialType?: string, children: TagListItem[] }[] {
        const parentCategories = this.categories.filter(c => !c.parentId).map(c => ({
            id: c.id,
            name: c.name,
            specialType: c.specialType,
            children: this.categories.filter(c2 => c2.parentId === c.id)
        }))

        return parentCategories
    }

    @action.bound onNewTag(parentId?: number) {
        this.addTagParentId = parentId
        this.isAddingTag = true
    }

    render() {
        const {parentCategories} = this

        return <AdminLayout title="Categories">
            <main className="TagsIndexPage">
                <FieldsRow>
                    <span>Showing {this.categories.length} categories</span>
                </FieldsRow>
                <p>Categories are a way of organizing data. Each dataset can be assigned to any number of categories. A category may be a subcategory of another category.</p>
                <div className="cardHolder">
                    <section>
                        <h4>Top-Level Categories</h4>
                        {parentCategories.map(parent =>
                            <TagBadge tag={parent as Tag}/>
                        )}
                        <button className="btn btn-default" onClick={() => this.onNewTag()}>+ New Category</button>
                    </section>
                    {parentCategories.map(parent =>
                        <section>
                            <h4>
                                {parent.name}
                            </h4>
                            {parent.specialType === "systemParent" && <p>These are special categories that are assigned automatically.</p>}
                            {parent.children.map(tag =>
                                <TagBadge tag={tag as Tag}/>
                            )}
                            <button className="btn btn-default" onClick={() => this.onNewTag(parent.id)}>+ New Category</button>
                        </section>
                    )}
                </div>
            </main>
            {this.isAddingTag && <AddTagModal parentId={this.addTagParentId} onClose={action(() => this.isAddingTag = false)}/>}
        </AdminLayout>
    }

    async getData() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => {
            this.categories = json.tags
        })
    }

    componentDidMount() {
        this.getData()
     }
}
