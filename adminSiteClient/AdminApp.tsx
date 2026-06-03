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
import { TestIndexPage } from "./TestIndexPage.js"
import { NotFoundPage } from "./NotFoundPage.js"
import { DeployStatusPage } from "./DeployStatusPage.js"
import { ExplorerTagsPage } from "./ExplorerTagsPage.js"
import {
    Navigate,
    useParams,
    useSearchParams,
    useNavigate,
    useLocation,
    createBrowserRouter,
    RouterProvider,
    Outlet,
} from "react-router"
import { LoadingBlocker, Modal } from "./Forms.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { ExplorerCreatePage } from "./ExplorerCreatePage.js"
import { ExplorersIndexPage } from "./ExplorersListPage.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { AdminLayout } from "./AdminLayout.js"
import { BulkGrapherConfigEditorPage } from "./BulkGrapherConfigEditor.js"
import { GdocsIndexPage } from "./GdocsIndexPage.js"
import { GdocsPreviewPage } from "./GdocsPreviewPage.js"
import { GdocsCoverageMatrixPage } from "./GdocsCoverageMatrixPage.js"
import { CalloutFunctionsPage } from "./CalloutFunctionsPage.js"
import { GdocsStoreProvider } from "./GdocsStoreProvider.js"
import { IndicatorChartEditorPage } from "./IndicatorChartEditorPage.js"
import { CreateNarrativeChartEditorPage } from "./CreateNarrativeChartEditorPage.js"
import { NarrativeChartEditorPage } from "./NarrativeChartEditorPage.js"
import { NarrativeChartIndexPage } from "./NarrativeChartIndexPage.js"
import { ImageIndexPage } from "./ImagesIndexPage.js"
import { FilesIndexPage } from "./FilesIndexPage.js"
import { DataInsightIndexPage } from "./DataInsightIndexPage.js"
import { MultiDimIndexPage } from "./MultiDimIndexPage.js"
import { MultiDimDetailPage } from "./MultiDimDetailPage.js"
import MultiDimRedirectsIndexPage from "./MultiDimRedirectsIndexPage.js"
import { FeaturedMetricsPage } from "./FeaturedMetricsPage.js"
import { DodsIndexPage } from "./DodsIndexPage.js"
import { StaticVizIndexPage } from "./StaticVizIndexPage.js"
import { StaticVizEditPage } from "./StaticVizEditPage.js"
import { SlideshowsIndexPage } from "./slideshows/SlideshowsIndexPage.js"
import { SlideshowEditorPage } from "./slideshows/SlideshowEditorPage.js"

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
    override render(): React.ReactElement | null {
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
    override render(): React.ReactElement | null {
        const { admin } = this.props
        return admin.showLoadingIndicator ? <LoadingBlocker /> : null
    }
}

const ChartCreatePageWrapper = () => {
    const [searchParams] = useSearchParams()
    const configParam = searchParams.get("config")
    const grapherConfig = configParam ? JSON.parse(configParam) : undefined
    return <ChartEditorPage grapherConfig={grapherConfig} />
}

const ChartEditorPageWrapper = () => {
    const params = useParams<{ chartId: string }>()
    return (
        <ChartEditorPage
            key={params.chartId}
            grapherId={parseInt(params.chartId!)}
        />
    )
}

const NarrativeChartEditorPageWrapper = () => {
    const params = useParams<{ narrativeChartId: string }>()
    return (
        <NarrativeChartEditorPage
            key={params.narrativeChartId}
            narrativeChartId={parseInt(params.narrativeChartId!)}
        />
    )
}

const ExplorerCreatePageWrapper = () => {
    const params = useParams<{ slug: string }>()
    const { admin } = React.useContext(AdminAppContext)
    return (
        <AdminLayout title="Create Explorer">
            <ExplorerCreatePage slug={params.slug!} manager={admin} />
        </AdminLayout>
    )
}

const UserEditPageWrapper = () => {
    const params = useParams<{ userId: string }>()
    return <UserEditPage userId={parseInt(params.userId!)} />
}

const IndicatorChartEditorPageWrapper = () => {
    const params = useParams<{ variableId: string }>()
    return (
        <IndicatorChartEditorPage variableId={parseInt(params.variableId!)} />
    )
}

const VariableEditPageWrapper = () => {
    const params = useParams<{ variableId: string }>()
    return <VariableEditPage variableId={parseInt(params.variableId!)} />
}

const DatasetEditPageWrapper = () => {
    const params = useParams<{ datasetId: string }>()
    return <DatasetEditPage datasetId={parseInt(params.datasetId!)} />
}

const SourceEditPageWrapper = () => {
    const params = useParams<{ sourceId: string }>()
    return <SourceEditPage sourceId={parseInt(params.sourceId!)} />
}

const TagEditPageWrapper = () => {
    const params = useParams<{ tagId: string }>()
    return <TagEditPage tagId={parseInt(params.tagId!)} />
}

const GdocsIndexPageWrapper = () => {
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <GdocsStoreProvider>
            <GdocsIndexPage location={location} navigate={navigate} />
        </GdocsStoreProvider>
    )
}

const AdminAppLayout = ({
    admin,
    childContext,
}: {
    admin: Admin
    childContext: any
}) => {
    return (
        <AdminAppContext.Provider value={childContext}>
            <div className="AdminApp">
                <AdminErrorMessage admin={admin} />
                <AdminLoader admin={admin} />
                <Outlet />
            </div>
        </AdminAppContext.Provider>
    )
}

@observer
export class AdminApp extends React.Component<{
    admin: Admin
}> {
    get childContext() {
        return { admin: this.props.admin }
    }

    router: any

    constructor(props: { admin: Admin }) {
        super(props)
        this.router = createBrowserRouter(
            [
                {
                    path: "/",
                    element: (
                        <AdminAppLayout
                            admin={props.admin}
                            childContext={this.childContext}
                        />
                    ),
                    children: [
                        {
                            path: "charts/create",
                            element: <ChartCreatePageWrapper />,
                        },
                        {
                            path: "charts/:chartId/edit",
                            element: <ChartEditorPageWrapper />,
                        },
                        {
                            path: "charts",
                            element: <ChartIndexPage />,
                        },
                        {
                            path: "narrative-charts",
                            element: <NarrativeChartIndexPage />,
                        },
                        {
                            path: "narrative-charts/create",
                            element: <CreateNarrativeChartEditorPage />,
                        },
                        {
                            path: "narrative-charts/:narrativeChartId/edit",
                            element: <NarrativeChartEditorPageWrapper />,
                        },
                        {
                            path: "featured-metrics",
                            element: <FeaturedMetricsPage />,
                        },
                        {
                            path: "multi-dims",
                            element: <MultiDimIndexPage />,
                        },
                        {
                            path: "multi-dims/:id",
                            element: <MultiDimDetailPage />,
                        },
                        {
                            path: "multi-dim-redirects",
                            element: <MultiDimRedirectsIndexPage />,
                        },
                        {
                            path: "dods",
                            element: <DodsIndexPage />,
                        },
                        {
                            path: "images",
                            element: <ImageIndexPage />,
                        },
                        {
                            path: "files",
                            element: <FilesIndexPage />,
                        },
                        {
                            path: "static-viz",
                            element: <StaticVizIndexPage />,
                        },
                        {
                            path: "static-viz/:staticVizId",
                            element: <StaticVizEditPage />,
                        },
                        {
                            path: "slideshows",
                            element: <SlideshowsIndexPage />,
                        },
                        {
                            path: "slideshows/create",
                            element: <SlideshowEditorPage />,
                        },
                        {
                            path: "slideshows/:slideshowId/edit",
                            element: <SlideshowEditorPage />,
                        },
                        {
                            path: `${EXPLORERS_ROUTE_FOLDER}/:slug`,
                            element: <ExplorerCreatePageWrapper />,
                        },
                        {
                            path: EXPLORERS_ROUTE_FOLDER,
                            element: (
                                <AdminLayout title="Explorers">
                                    <ExplorersIndexPage />
                                </AdminLayout>
                            ),
                        },
                        {
                            path: "bulk-grapher-config-editor",
                            element: <BulkGrapherConfigEditorPage />,
                        },
                        {
                            path: "variable-annotations",
                            element: <VariablesAnnotationPage />,
                        },
                        {
                            path: "users/:userId",
                            element: <UserEditPageWrapper />,
                        },
                        {
                            path: "users",
                            element: <UsersIndexPage />,
                        },
                        {
                            path: "variables/:variableId/config",
                            element: <IndicatorChartEditorPageWrapper />,
                        },
                        {
                            path: "variables/:variableId",
                            element: <VariableEditPageWrapper />,
                        },
                        {
                            path: "variables",
                            element: <VariablesIndexPage />,
                        },
                        {
                            path: "datasets/:datasetId",
                            element: <DatasetEditPageWrapper />,
                        },
                        {
                            path: "datasets",
                            element: <DatasetsIndexPage />,
                        },
                        {
                            path: "sources/:sourceId",
                            element: <SourceEditPageWrapper />,
                        },
                        {
                            path: "redirects",
                            element: <RedirectsIndexPage />,
                        },
                        {
                            path: "site-redirects",
                            element: <SiteRedirectsIndexPage />,
                        },
                        {
                            path: "tags/:tagId",
                            element: <TagEditPageWrapper />,
                        },
                        {
                            path: "tag-graph",
                            element: <TagGraphPage />,
                        },
                        {
                            path: "tags",
                            element: <TagsIndexPage />,
                        },
                        {
                            path: "gdocs/:id/preview",
                            element: (
                                <GdocsStoreProvider>
                                    <GdocsPreviewPage />
                                </GdocsStoreProvider>
                            ),
                        },
                        {
                            path: "gdocs/:id/coverage",
                            element: (
                                <GdocsStoreProvider>
                                    <GdocsCoverageMatrixPage />
                                </GdocsStoreProvider>
                            ),
                        },
                        {
                            path: "callout-functions",
                            element: <CalloutFunctionsPage />,
                        },
                        {
                            path: "gdocs/*",
                            element: <GdocsIndexPageWrapper />,
                        },
                        {
                            path: "data-insights",
                            element: <DataInsightIndexPage />,
                        },
                        {
                            path: "test",
                            element: <TestIndexPage />,
                        },
                        {
                            path: "deploys",
                            element: <DeployStatusPage />,
                        },
                        {
                            path: "explorer-tags",
                            element: <ExplorerTagsPage />,
                        },
                        {
                            path: "",
                            element: <Navigate to="/charts" replace />,
                        },
                        {
                            path: "*",
                            element: <NotFoundPage />,
                        },
                    ],
                },
            ],
            {
                basename: props.admin.basePath,
            }
        )
    }

    override render(): React.ReactElement {
        return (
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={this.router} />
            </QueryClientProvider>
        )
    }
}
