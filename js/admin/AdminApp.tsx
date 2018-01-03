import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'
import {observable, action} from 'mobx'
import {observer} from 'mobx-react'
import { EditorFAQ } from './EditorFAQ'
import ChartIndexPage from './ChartIndexPage'

@observer
export default class AdminApp extends React.Component<{ admin: Admin }> {
    @observable isFAQ: boolean = false

    @action.bound onToggleFAQ() {
        this.isFAQ = !this.isFAQ
    }

    render() {
        const {admin} = this.props
        const {isFAQ} = this

        const m = admin.currentPath.match(/\/charts\/(\d+)\/edit/)
        const chartId = m ? parseInt(m[1]) : undefined

        const adminRootUrl = "/grapher/admin"

        return <div className="AdminApp">
            <nav className="navbar navbar-dark bg-dark flex-row navbar-expand-lg">
                <a className="navbar-brand" href={adminRootUrl}>owid-grapher</a>
                <ul className="navbar-nav">
                    <li className="nav-item">
                        <a className="nav-link" href={`${adminRootUrl}/charts/create`}>
                            <i className="fa fa-plus"/> New chart
                        </a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" onClick={this.onToggleFAQ}>
                            FAQ
                        </a>
                    </li>
                </ul>
                <ul className="navbar-nav ml-auto">
                    <li className="nav-item">
                        <a className="nav-link logout" href={`${adminRootUrl}/logout`}>
                            {admin.username}
                        </a>
                    </li>
                </ul>
            </nav>
            {isFAQ && <EditorFAQ onClose={this.onToggleFAQ}/>}
            <ChartEditorPage admin={admin} chartId={chartId}/>
        </div>
    }
}
