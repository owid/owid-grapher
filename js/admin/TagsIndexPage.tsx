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
    parentName: string
}

@observer
class AddTagModal extends React.Component<{ parentId: number, onClose: () => void }> {
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
                    <h5 className="modal-title">Add tag</h5>
                </div>
                <div className="modal-body">
                    <TextField label="Tag to add" value={this.tagName} onValue={this.onTagName} autofocus required/>
                </div>
                <div className="modal-footer">
                    <input type="submit" className="btn btn-primary">Send invite</input>
                </div>
            </form>
            {this.newTagId !== undefined && <Redirect to={`/tags/${this.newTagId}`}/>}
        </Modal>
    }
}

@observer
export default class TagsIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable tags: TagListItem[] = []
    @observable addTagParentId?: number

    @computed get parentCategories(): { id: number, name: string, tags: TagListItem[] }[] {
        const tagsByParent = _.groupBy(this.tags, c => c.parentName)
        return _.map(tagsByParent, (tags, parentName) => ({ id: tags[0].parentId, name: parentName, tags: tags }))
    }

    @action.bound onNewTag(parentId: number) {
        this.addTagParentId = parentId
    }

    render() {
        const {parentCategories} = this

        return <AdminLayout title="Tags">
            <main className="TagsIndexPage">
                <FieldsRow>
                    <span>Showing {this.tags.length} tags</span>
                </FieldsRow>
                <div className="cardHolder">
                    {parentCategories.map(parent =>
                        <section>
                            <h4>
                                {parent.name}
                            </h4>
                            {parent.tags.map(tag =>
                                <TagBadge tag={tag as Tag}/>
                            )}
                            <button className="btn btn-default" onClick={() => this.onNewTag(parent.id)}>+ New Tag</button>
                        </section>
                    )}
                </div>
            </main>
            {this.addTagParentId !== undefined && <AddTagModal parentId={this.addTagParentId} onClose={action(() => this.addTagParentId = undefined)}/>}
        </AdminLayout>
    }

    async getData() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => {
            this.tags = json.tags
        })
    }

    componentDidMount() {
        this.getData()
     }
}
