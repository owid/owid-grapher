import Admin from './Admin'
import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
import { Modal, LoadingBlocker, TextField } from './Forms'
import Link from './Link'
import AdminSidebar from './AdminSidebar'
import FuzzySearch from '../charts/FuzzySearch'
import { uniq } from '../charts/Util'
import { UserIndexMeta } from '../../src/admin/api'
const timeago = require('timeago.js')()

@observer
export default class UsersIndexPage extends React.Component {
    context!: { admin: Admin }
    @observable users: UserIndexMeta[] = []

    @action.bound async onDelete(user: UserIndexMeta) {
        if (!window.confirm(`Delete the user ${user.name}? This action cannot be undone!`))
            return

        const json = await this.context.admin.requestJSON(`/api/users/${user.id}`, {}, "DELETE")

        if (json.success) {
            runInAction(() => this.users.splice(this.users.indexOf(user), 1))
        }
    }

    render() {
        const {users} = this
        return <main className="UsersIndexPage">
            <div className="topbar">
                <h2>Users</h2>
                <a href="/grapher/admin/invite" className="btn btn-primary">Invite a user</a>
            </div>
            <table className="table table-bordered">
                <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th></th>
                    <th></th>
                </tr>
                {users.map(user =>
                    <tr>
                        <td>{user.name}</td>
                        <td>{user.fullName}</td>
                        <td>{timeago.format(user.createdAt)}</td>
                        <td>{user.isActive ? 'active' : 'inactive'}</td>
                        <td>
                            <Link to={`/users/${user.id}/edit`} className="btn btn-primary">Edit</Link>
                        </td>
                        <td>
                            <button className="btn btn-danger" onClick={_ => this.onDelete(user)}>Delete</button>
                        </td>
                    </tr>
                )}
            </table>
        </main>
    }

    async getData() {
        const {admin} = this.context

        const json = await admin.getJSON("/api/users.json")
        runInAction(() => {
            this.users = json.users
        })
    }

    componentDidMount() {
        this.getData()
    }
}
