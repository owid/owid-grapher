import * as React from "react"
import { Admin } from "./Admin"
import { ChartEditorPage } from "./ChartEditorPage"
import { action } from "mobx"
import { observer } from "mobx-react"
import { ChartIndexPage } from "./ChartIndexPage"
import { UsersIndexPage } from "./UsersIndexPage"
import { DatasetsIndexPage } from "./DatasetsIndexPage"
import { CountryStandardizerPage } from "./CountryStandardizerPage"
import { UserEditPage } from "./UserEditPage"
import { VariableEditPage } from "./VariableEditPage"
import { VariablesIndexPage } from "./VariablesIndexPage"
import { DatasetEditPage } from "./DatasetEditPage"
import { SourceEditPage } from "./SourceEditPage"
import { RedirectsIndexPage } from "./RedirectsIndexPage"
import { TagEditPage } from "./TagEditPage"
import { TagsIndexPage } from "./TagsIndexPage"
import { PostsIndexPage } from "./PostsIndexPage"
import { TestIndexPage } from "./TestIndexPage"
import { ImportPage } from "./ImportPage"
import { NotFoundPage } from "./NotFoundPage"
import { PostEditorPage } from "./PostEditorPage"
import { NewsletterPage } from "./NewsletterPage"
import {
    BrowserRouter as Router,
    Route,
    Switch,
    Redirect
} from "react-router-dom"
import { LoadingBlocker, Modal } from "./Forms"
import { AdminAppContext } from "./AdminAppContext"
import { Base64 } from "js-base64"

@observer
class AdminErrorMessage extends React.Component<{ admin: Admin }> {
    render() {
        const { admin } = this.props
        const error = admin.errorMessage

        return error ? (
            <Modal
                className="errorMessage"
                onClose={action(() => {
                    error.isFatal
                        ? window.location.reload()
                        : (admin.errorMessage = undefined)
                })}
            >
                <div className="modal-header">
                    <div>
                        <h5
                            className="modal-title"
                            style={error.isFatal ? { color: "red" } : undefined}
                        >
                            {error.title}
                        </h5>
                        {error.isFatal && (
                            <p>
                                Please screenshot this error message and report
                                it in{" "}
                                <a href="https://owid.slack.com/messages/tech-issues/">
                                    #tech-issues
                                </a>
                            </p>
                        )}
                    </div>
                </div>
                <div className="modal-body">
                    <pre dangerouslySetInnerHTML={{ __html: error.content }} />
                </div>
            </Modal>
        ) : null
    }
}

@observer
class AdminLoader extends React.Component<{ admin: Admin }> {
    render() {
        const { admin } = this.props
        return admin.isLoading ? <LoadingBlocker /> : null
    }
}

@observer
export class AdminApp extends React.Component<{ admin: Admin }> {
    get childContext() {
        return { admin: this.props.admin }
    }

    render() {
        const { admin } = this.props

        return (
            <AdminAppContext.Provider value={this.childContext}>
                <Router basename={admin.basePath}>
                    <div className="AdminApp">
                        <AdminErrorMessage admin={admin} />
                        <AdminLoader admin={admin} />
                        <Switch>
                            <Route
                                exact
                                path="/charts/create/:config"
                                render={({ match }) => (
                                    <ChartEditorPage
                                        chartConfig={JSON.parse(
                                            Base64.decode(match.params.config)
                                        )}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/charts/create"
                                component={ChartEditorPage}
                            />
                            <Route
                                exact
                                path="/charts/:chartId/edit"
                                render={({ match }) => (
                                    <ChartEditorPage
                                        chartId={parseInt(match.params.chartId)}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/charts"
                                component={ChartIndexPage}
                            />
                            <Route
                                exact
                                path="/users/:userId"
                                render={({ match }) => (
                                    <UserEditPage
                                        userId={parseInt(match.params.userId)}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/users"
                                component={UsersIndexPage}
                            />
                            <Route
                                exact
                                path="/import"
                                component={ImportPage}
                            />
                            <Route
                                exact
                                path="/variables/:variableId"
                                render={({ match }) => (
                                    <VariableEditPage
                                        variableId={parseInt(
                                            match.params.variableId
                                        )}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/variables"
                                component={VariablesIndexPage}
                            />
                            <Route
                                exact
                                path="/datasets/:datasetId"
                                render={({ match }) => (
                                    <DatasetEditPage
                                        datasetId={parseInt(
                                            match.params.datasetId
                                        )}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/datasets"
                                component={DatasetsIndexPage}
                            />
                            <Route
                                exact
                                path="/sources/:sourceId"
                                render={({ match }) => (
                                    <SourceEditPage
                                        sourceId={parseInt(
                                            match.params.sourceId
                                        )}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/standardize"
                                component={CountryStandardizerPage}
                            />
                            <Route
                                exact
                                path="/redirects"
                                component={RedirectsIndexPage}
                            />
                            <Route
                                exact
                                path="/tags/:tagId"
                                render={({ match }) => (
                                    <TagEditPage
                                        tagId={parseInt(match.params.tagId)}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/tags"
                                component={TagsIndexPage}
                            />
                            <Route
                                exact
                                path="/posts"
                                component={PostsIndexPage}
                            />
                            <Route
                                exact
                                path="/posts/:postId/edit"
                                render={({ match }) => (
                                    <PostEditorPage
                                        postId={parseInt(match.params.postId)}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/test"
                                component={TestIndexPage}
                            />
                            <Route
                                exact
                                path="/newsletter"
                                component={NewsletterPage}
                            />
                            <Route
                                exact
                                path="/"
                                render={() => <Redirect to="/charts" />}
                            />
                            <Route component={NotFoundPage} />
                        </Switch>
                    </div>
                </Router>
            </AdminAppContext.Provider>
        )
    }
}
