import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'
import {observable, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartIndexPage from './ChartIndexPage'
import UsersIndexPage from './UsersIndexPage'
import DatasetsIndexPage from './DatasetsIndexPage'
import UserEditPage from './UserEditPage'
import VariableEditPage from './VariableEditPage'
import VariablesIndexPage from './VariablesIndexPage'
import DatasetEditPage from './DatasetEditPage'
import SourceEditPage from './SourceEditPage'
import ImportPage from './ImportPage'
import NotFoundPage from './NotFoundPage'
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom'
import Link from './Link'
import { LoadingBlocker, Modal } from './Forms'

@observer
class AdminErrorMessage extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props
        const error = admin.errorMessage

        return error ? <Modal className="errorMessage" onClose={action(() => { error.isFatal ? window.location.reload() : admin.errorMessage = undefined })}>
            <div className="modal-header">
                <div>
                    <h5 className="modal-title" style={error.isFatal ? { color: 'red' } : undefined}>{error.title}</h5>
                    {error.isFatal && <p>Please screenshot this error message and report it in <a href="https://owid.slack.com/messages/tiny-tech-problems/">#tiny-tech-problems</a></p>}
                </div>
            </div>
            <div className="modal-body">
                <pre dangerouslySetInnerHTML={{__html: error.content}}/>
            </div>
        </Modal> : null
    }
}

@observer
class AdminLoader extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props
        return admin.isLoading ? <LoadingBlocker/> : null
    }
}

@observer
export default class AdminApp extends React.Component<{ admin: Admin }> {
    getChildContext() {
        return { admin: this.props.admin }
    }

    render() {
        const {admin} = this.props

        return <Router basename={admin.basePath}>
            <div className="AdminApp">
                <AdminErrorMessage admin={admin}/>
                <AdminLoader admin={admin}/>
                <Switch>
                    <Route exact path="/charts/create/:config" render={({ match }) => <ChartEditorPage chartConfig={JSON.parse(decodeURIComponent(match.params.config))}/>}/>
                    <Route exact path="/charts/create" component={ChartEditorPage}/>
                    <Route exact path="/charts/:chartId/edit" render={({ match }) => <ChartEditorPage chartId={parseInt(match.params.chartId)}/>}/>
                    <Route exact path="/charts" component={ChartIndexPage}/>
                    <Route exact path="/users/:userId" render={({ match }) => <UserEditPage userId={parseInt(match.params.userId)}/>}/>
                    <Route exact path="/users" component={UsersIndexPage}/>
                    <Route exact path="/import" component={ImportPage}/>
                    <Route exact path="/variables/:variableId" render={({ match }) => <VariableEditPage variableId={parseInt(match.params.variableId)}/>}/>
                    <Route exact path="/variables" component={VariablesIndexPage}/>
                    <Route exact path="/datasets/:datasetId" render={({ match }) => <DatasetEditPage datasetId={parseInt(match.params.datasetId)}/>}/>
                    <Route exact path="/datasets" component={DatasetsIndexPage}/>
                    <Route exact path="/sources/:sourceId" render={({ match }) => <SourceEditPage sourceId={parseInt(match.params.sourceId)}/>}/>
                    <Route exact path="/" render={() => <Redirect to="/charts"/>}/>
                    <Route component={NotFoundPage}/>
                </Switch>
            </div>
        </Router>
    }
}
