import React from "react"
import { Admin } from "./Admin.js"
import { ChartEditorPage } from "./ChartEditorPage.js"
import { action } from "mobx"
import { observer } from "mobx-react"
import { ChartIndexPage } from "./ChartIndexPage.js"
import { UsersIndexPage } from "./UsersIndexPage.js"
import { DatasetsIndexPage } from "./DatasetsIndexPage.js"
import { CountryStandardizerPage } from "./CountryStandardizerPage.js"
import { UserEditPage } from "./UserEditPage.js"
import { VariableEditPage } from "./VariableEditPage.js"
import { VariablesIndexPage } from "./VariablesIndexPage.js"
import { DatasetEditPage } from "./DatasetEditPage.js"
import { VariablesAnnotationPage } from "./VariablesAnnotationPage.js"
import { SourceEditPage } from "./SourceEditPage.js"
import { RedirectsIndexPage } from "./RedirectsIndexPage.js"
import { TagEditPage } from "./TagEditPage.js"
import { TagsIndexPage } from "./TagsIndexPage.js"
import { PostsIndexPage } from "./PostsIndexPage.js"
import { TestIndexPage } from "./TestIndexPage.js"
import { ImportPage } from "./ImportPage.js"
import { NotFoundPage } from "./NotFoundPage.js"
import { PostEditorPage } from "./PostEditorPage.js"
import { NewsletterPage } from "./NewsletterPage.js"
import { DeployStatusPage } from "./DeployStatusPage.js"
import { SuggestedChartRevisionApproverPage } from "./SuggestedChartRevisionApproverPage.js"
import { SuggestedChartRevisionListPage } from "./SuggestedChartRevisionListPage.js"
import { SuggestedChartRevisionImportPage } from "./SuggestedChartRevisionImportPage.js"
import { BulkDownloadPage } from "./BulkDownloadPage.js"
import {
    BrowserRouter as Router,
    Route,
    Switch,
    Redirect,
} from "react-router-dom"
import { LoadingBlocker, Modal } from "./Forms.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Base64 } from "js-base64"
import { ExplorerCreatePage } from "../explorerAdminClient/ExplorerCreatePage.js"
import { ExplorersIndexPage } from "../explorerAdminClient/ExplorersListPage.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import { AdminLayout } from "./AdminLayout.js"
import { BulkGrapherConfigEditorPage } from "./BulkGrapherConfigEditor.js"
import { DetailsOnDemandPage } from "./DetailsOnDemand.js"

@observer
class AdminErrorMessage extends React.Component<{ admin: Admin }> {
    render(): JSX.Element | null {
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
    render(): JSX.Element | null {
        const { admin } = this.props
        return admin.showLoadingIndicator ? <LoadingBlocker /> : null
    }
}

@observer
export class AdminApp extends React.Component<{
    admin: Admin
    gitCmsBranchName: string
}> {
    get childContext() {
        return { admin: this.props.admin }
    }

    render(): JSX.Element {
        const { admin, gitCmsBranchName } = this.props

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
                                        grapherConfig={JSON.parse(
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
                                        grapherId={parseInt(
                                            match.params.chartId
                                        )}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/charts/:chartId/edit/:config"
                                render={({ match }) => (
                                    <ChartEditorPage
                                        grapherConfig={JSON.parse(
                                            Base64.decode(match.params.config)
                                        )}
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
                                path={`/${EXPLORERS_ROUTE_FOLDER}/:slug`}
                                render={({ match }) => (
                                    <AdminLayout title="Create Explorer">
                                        <ExplorerCreatePage
                                            slug={match.params.slug}
                                            gitCmsBranchName={gitCmsBranchName}
                                            manager={admin}
                                        />
                                    </AdminLayout>
                                )}
                            />
                            <Route
                                exact
                                path={`/${EXPLORERS_ROUTE_FOLDER}`}
                                render={() => (
                                    <AdminLayout title="Explorers">
                                        <ExplorersIndexPage />
                                    </AdminLayout>
                                )}
                            />
                            <Route
                                exact
                                path={`/bulk-grapher-config-editor`}
                                render={() => <BulkGrapherConfigEditorPage />}
                            />
                            <Route
                                exact
                                path={`/variable-annotations`}
                                render={() => <VariablesAnnotationPage />}
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
                                path="/details"
                                component={DetailsOnDemandPage}
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
                                path="/deploys"
                                component={DeployStatusPage}
                            />
                            <Route
                                exact
                                path="/newsletter"
                                component={NewsletterPage}
                            />
                            <Route
                                exact
                                path="/suggested-chart-revisions"
                                component={SuggestedChartRevisionListPage}
                            />
                            <Route
                                exact
                                path="/suggested-chart-revisions/import"
                                component={SuggestedChartRevisionImportPage}
                            />
                            <Route
                                exact
                                path="/suggested-chart-revisions/review"
                                component={SuggestedChartRevisionApproverPage}
                            />
                            <Route
                                exact
                                path="/suggested-chart-revisions/review/:suggestedChartRevisionId"
                                render={({ match }) => (
                                    <SuggestedChartRevisionApproverPage
                                        suggestedChartRevisionId={parseInt(
                                            match.params
                                                .suggestedChartRevisionId
                                        )}
                                    />
                                )}
                            />
                            <Route
                                exact
                                path="/bulk-downloads"
                                component={BulkDownloadPage}
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
