import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'
import {observable, action} from 'mobx'
import {observer} from 'mobx-react'
import { EditorFAQ } from './EditorFAQ'
import ChartIndexPage from './ChartIndexPage'
import AdminSidebar from './AdminSidebar'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import Link from './Link'
import { LoadingBlocker } from './Forms'

@observer
export default class AdminApp extends React.Component<{ admin: Admin }> {
    @observable isFAQ: boolean = false

    @action.bound onToggleFAQ() {
        this.isFAQ = !this.isFAQ
    }

    getChildContext() {
        return { admin: this.props.admin }
    }

    render() {
        const {admin} = this.props
        const {isFAQ} = this

        return <Router basename={admin.basePath}>
            <div className="AdminApp">
                <nav className="navbar navbar-dark bg-dark flex-row navbar-expand-lg">
                    <Link className="navbar-brand" to="/">owid-grapher</Link>
                    <ul className="navbar-nav">
                        <li className="nav-item">
                            <Link className="nav-link" to="/charts/create" native>
                                <i className="fa fa-plus"/> New chart
                            </Link>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link" onClick={this.onToggleFAQ}>
                                FAQ
                            </a>
                        </li>
                    </ul>
                    <ul className="navbar-nav ml-auto">
                        <li className="nav-item">
                            <Link className="nav-link logout" to="/logout" native>
                                {admin.username}
                            </Link>
                        </li>
                    </ul>
                </nav>
                {isFAQ && <EditorFAQ onClose={this.onToggleFAQ}/>}
                {admin.isLoading && <LoadingBlocker/>}
                <Switch>
                    <Route path="/charts/create" component={ChartEditorPage}/>
                    <Route path="/charts/:chartId/edit" render={({ match }) => <ChartEditorPage chartId={parseInt(match.params.chartId)}/>}/>
                    <Route path="/" component={ChartIndexPage}/>
                </Switch>
            </div>
        </Router>
    }
}
