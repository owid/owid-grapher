import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as React from "react"
import { Admin } from "./Admin.js"
import { ChartEditorPage } from "./ChartEditorPage.js"
import { action } from "mobx"
import { observer } from "mobx-react"
import { ChartIndexPage } from "./ChartIndexPage.js"
import { UsersIndexPage } from "./UsersIndexPage.js"
import { DatasetsIndexPage } from "./DatasetsIndexPage.js"
import { UserEditPage } from "./UserEditPage.js"
import { VariableEditPage } from "./VariableEditPage.js"
import { VariablesIndexPage } from "./VariablesIndexPage.js"
import { DatasetEditPage } from "./DatasetEditPage.js"
import { VariablesAnnotationPage } from "./VariablesAnnotationPage.js"
import { SourceEditPage } from "./SourceEditPage.js"
import { RedirectsIndexPage } from "./RedirectsIndexPage.js"
import SiteRedirectsIndexPage from "./SiteRedirectsIndexPage"
import { TagEditPage } from "./TagEditPage.js"
import { TagsIndexPage } from "./TagsIndexPage.js"
import { TagGraphPage } from "./TagGraphPage.js"
import { PostsIndexPage } from "./PostsIndexPage.js"
import { TestIndexPage } from "./TestIndexPage.js"
import { NotFoundPage } from "./NotFoundPage.js"
import { PostEditorPage } from "./PostEditorPage.js"
import { DeployStatusPage } from "./DeployStatusPage.js"
import { ExplorerTagsPage } from "./ExplorerTagsPage.js"
import { BulkDownloadPage } from "./BulkDownloadPage.js"
import {
    BrowserRouter as Router,
    Route,
    Switch,
    Redirect,
    RouteComponentProps,
} from "react-router-dom"
import { LoadingBlocker, Modal } from "./Forms.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Base64 } from "js-base64"
import { ExplorerCreatePage } from "./ExplorerCreatePage.js"
import { ExplorersIndexPage } from "./ExplorersListPage.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { AdminLayout } from "./AdminLayout.js"
import { BulkGrapherConfigEditorPage } from "./BulkGrapherConfigEditor.js"
import { GdocsIndexPage } from "./GdocsIndexPage.js"
import { GdocsMatchProps, GdocsPreviewPage } from "./GdocsPreviewPage.js"
import { GdocsStoreProvider } from "./GdocsStoreProvider.js"
import { IndicatorChartEditorPage } from "./IndicatorChartEditorPage.js"
import { ChartViewEditorPage } from "./ChartViewEditorPage.js"
import { ChartViewIndexPage } from "./ChartViewIndexPage.js"
import { ImageIndexPage } from "./ImagesIndexPage.js"
import { DataInsightIndexPage } from "./DataInsightIndexPage.js"
import { MultiDimIndexPage } from "./MultiDimIndexPage.js"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // This is not what we've done in the past, so the behavior might
            // be confusing for users.
            refetchOnWindowFocus: false,
        },
    },
})

@observer
class AdminErrorMessage extends React.Component<{ admin: Admin }> {
    render(): React.ReactElement | null {
        const { admin } = this.props
        const error = admin.errorMessage

        return error ? (
            <Modal
                className="errorMessage"
                onClose={action(() => {
                    if (error.isFatal) {
                        window.location.reload()
                    } else {
                        admin.errorMessage = undefined
                    }
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
    render(): React.ReactElement | null {
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

    render(): React.ReactElement {
        const { admin, gitCmsBranchName } = this.props

        return (
            <QueryClientProvider client={queryClient}>
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
                                                Base64.decode(
                                                    match.params.config
                                                )
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
                                                Base64.decode(
                                                    match.params.config
                                                )
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
                                    path="/chartViews"
                                    component={ChartViewIndexPage}
                                />
                                <Route
                                    exact
                                    path="/chartViews/:chartViewId/edit"
                                    render={({ match }) => (
                                        <ChartViewEditorPage
                                            chartViewId={parseInt(
                                                match.params.chartViewId
                                            )}
                                        />
                                    )}
                                />
                                <Route
                                    exact
                                    path="/multi-dims"
                                    component={MultiDimIndexPage}
                                />
                                <Route
                                    path="/images"
                                    component={ImageIndexPage}
                                />
                                <Route
                                    exact
                                    path={`/${EXPLORERS_ROUTE_FOLDER}/:slug`}
                                    render={({ match }) => (
                                        <AdminLayout title="Create Explorer">
                                            <ExplorerCreatePage
                                                slug={match.params.slug}
                                                gitCmsBranchName={
                                                    gitCmsBranchName
                                                }
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
                                    render={() => (
                                        <BulkGrapherConfigEditorPage />
                                    )}
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
                                            userId={parseInt(
                                                match.params.userId
                                            )}
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
                                    path="/variables/:variableId/config"
                                    render={({ match }) => (
                                        <IndicatorChartEditorPage
                                            variableId={parseInt(
                                                match.params.variableId
                                            )}
                                        />
                                    )}
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
                                    path="/redirects"
                                    component={RedirectsIndexPage}
                                />
                                <Route
                                    exact
                                    path="/site-redirects"
                                    component={SiteRedirectsIndexPage}
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
                                    path="/tag-graph"
                                    component={TagGraphPage}
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
                                            postId={parseInt(
                                                match.params.postId
                                            )}
                                        />
                                    )}
                                />
                                <Route
                                    exact
                                    path="/gdocs/:id/preview"
                                    render={(props: GdocsMatchProps) => (
                                        <GdocsStoreProvider>
                                            <GdocsPreviewPage {...props} />
                                        </GdocsStoreProvider>
                                    )}
                                />
                                <Route
                                    path="/gdocs"
                                    render={(props: RouteComponentProps) => (
                                        <GdocsStoreProvider>
                                            <GdocsIndexPage {...props} />
                                        </GdocsStoreProvider>
                                    )}
                                />
                                <Route
                                    path="/data-insights"
                                    component={DataInsightIndexPage}
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
                                    path="/explorer-tags"
                                    component={ExplorerTagsPage}
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
            </QueryClientProvider>
        )
    }
}
