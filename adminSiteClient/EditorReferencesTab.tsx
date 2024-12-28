import { Component, Fragment } from "react"
import { observer } from "mobx-react"
import {
    ChartEditor,
    getFullReferencesCount,
    isChartEditorInstance,
} from "./ChartEditor.js"
import { computed, action, observable, runInAction } from "mobx"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    stringifyUnknownError,
    formatValue,
    ChartRedirect,
    partition,
    round,
} from "@ourworldindata/utils"
import { AbstractChartEditor, References } from "./AbstractChartEditor.js"
import {
    IndicatorChartInfo,
    IndicatorChartEditor,
    isIndicatorChartEditorInstance,
} from "./IndicatorChartEditor.js"
import { Section } from "./Forms.js"

const BASE_URL = BAKED_GRAPHER_URL.replace(/^https?:\/\//, "")

@observer
export class EditorReferencesTab<
    Editor extends AbstractChartEditor,
> extends Component<{
    editor: Editor
}> {
    render() {
        const { editor } = this.props
        if (isChartEditorInstance(editor))
            return <EditorReferencesTabForChart editor={editor} />
        else if (isIndicatorChartEditorInstance(editor))
            return <EditorReferencesTabForIndicator editor={editor} />
        else return null
    }
}

export const ReferencesSection = (props: {
    references: References | undefined
}) => {
    const wpPosts = props.references?.postsWordpress?.length ? (
        <>
            {" "}
            <p>Public wordpress pages that embed or reference this chart:</p>
            <ul className="list-group">
                {props.references.postsWordpress.map((post) => (
                    <li key={post.id} className="list-group-item">
                        <a href={post.url} target="_blank" rel="noopener">
                            <strong>{post.title}</strong>
                        </a>{" "}
                        (
                        <a
                            href={`https://owid.cloud/wp/wp-admin/post.php?post=${post.id}&action=edit`}
                            target="_blank"
                            rel="noopener"
                        >
                            Edit
                        </a>
                        )
                    </li>
                ))}
            </ul>
        </>
    ) : (
        <></>
    )
    const gdocsPosts = props.references?.postsGdocs?.length ? (
        <>
            <p>Public gdocs pages that embed or reference this chart:</p>
            <ul className="list-group">
                {props.references.postsGdocs.map((post) => (
                    <li key={post.id} className="list-group-item">
                        <a href={post.url} target="_blank" rel="noopener">
                            <strong>{post.title}</strong>
                        </a>{" "}
                        (
                        <a
                            href={`/admin/gdocs/${post.id}`}
                            target="_blank"
                            rel="noopener"
                        >
                            Edit
                        </a>
                        )
                    </li>
                ))}
            </ul>
        </>
    ) : (
        <></>
    )
    const explorers = props.references?.explorers?.length ? (
        <>
            <p>Explorers that reference this chart:</p>
            <ul className="list-group">
                {props.references.explorers.map((explorer) => (
                    <li key={explorer} className="list-group-item">
                        <a
                            href={`https://ourworldindata.org/explorers/${explorer}`}
                            target="_blank"
                            rel="noopener"
                        >
                            <strong>{explorer}</strong>
                        </a>{" "}
                        (
                        <a
                            href={`/admin/explorers/${explorer}`}
                            target="_blank"
                            rel="noopener"
                        >
                            Edit
                        </a>
                        )
                    </li>
                ))}
            </ul>
        </>
    ) : (
        <></>
    )

    const chartViews = !!props.references?.chartViews?.length && (
        <>
            <p>Narrative charts based on this chart</p>
            <ul className="list-group">
                {props.references.chartViews.map((chartView) => (
                    <li key={chartView.id} className="list-group-item">
                        <a
                            href={`/admin/chartViews/${chartView.id}/edit`}
                            target="_blank"
                            rel="noopener"
                        >
                            <strong>{chartView.title}</strong>
                        </a>
                    </li>
                ))}
            </ul>
        </>
    )

    return (
        <>
            <h5>References</h5>
            {props.references &&
            getFullReferencesCount(props.references) > 0 ? (
                <>
                    {wpPosts}
                    {gdocsPosts}
                    {explorers}
                    {chartViews}
                </>
            ) : (
                <p>No references found</p>
            )}
        </>
    )
}

@observer
export class EditorReferencesTabForChart extends Component<{
    editor: ChartEditor
}> {
    @computed get isPersisted() {
        return this.props.editor.grapher.id
    }

    @computed get references() {
        return this.props.editor.references
    }
    @computed get redirects() {
        return this.props.editor.redirects || []
    }

    @computed get pageviews() {
        return this.props.editor.pageviews
    }

    @action.bound appendRedirect(redirect: ChartRedirect) {
        this.props.editor.manager.redirects.push(redirect)
    }

    renderPageview(views: number | undefined) {
        return views !== undefined
            ? formatValue(views, { unit: "views" })
            : "No data"
    }

    render() {
        return (
            <div>
                <section>
                    <h5>Pageviews</h5>
                    <div>
                        <div>
                            <strong>Last 7 days:</strong>{" "}
                            {this.renderPageview(this.pageviews?.views_7d)}
                        </div>
                        <div>
                            <strong>Last 14 days:</strong>{" "}
                            {this.renderPageview(this.pageviews?.views_14d)}
                        </div>
                        <div>
                            <strong>Last 365 days:</strong>{" "}
                            {this.renderPageview(this.pageviews?.views_365d)}
                        </div>
                        <div>
                            <strong>
                                Average pageviews per day over the last year:
                            </strong>{" "}
                            {this.renderPageview(
                                this.pageviews?.views_365d
                                    ? round(this.pageviews?.views_365d / 365, 1)
                                    : undefined
                            )}
                        </div>
                    </div>
                    <small className="form-text text-muted">
                        Pageview numbers are inaccurate when the chart has been
                        published or renamed recently. The numbers are updated
                        nightly.
                    </small>
                </section>
                <section>
                    <ReferencesSection references={this.references} />
                </section>
                <section>
                    <h5>Alternative URLs for this chart</h5>
                    {this.redirects.length ? (
                        <Fragment>
                            <p>The following URLs redirect to this chart:</p>
                            <ul className="list-group">
                                {this.redirects.map((redirect) => (
                                    <li
                                        key={redirect.id}
                                        className="list-group-item"
                                    >
                                        <span className="redirect-prefix">
                                            {BASE_URL}/
                                        </span>
                                        <a
                                            href={`${BAKED_GRAPHER_URL}/${redirect.slug}`}
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            <strong>{redirect.slug}</strong>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            <hr />
                        </Fragment>
                    ) : null}
                    {this.isPersisted && (
                        <AddRedirectForm
                            editor={this.props.editor}
                            onSuccess={this.appendRedirect}
                        />
                    )}
                </section>
            </div>
        )
    }
}

@observer
class AddRedirectForm<Editor extends AbstractChartEditor> extends Component<{
    editor: Editor
    onSuccess: (redirect: ChartRedirect) => void
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable slug?: string = ""

    @observable isLoading: boolean = false
    @observable errorMessage?: string

    @action.bound onChange(slug: string) {
        this.slug = slug
    }

    @action.bound async onSubmit() {
        if (!this.isLoading) {
            this.isLoading = true
            try {
                const chartId = this.props.editor.grapher.id
                const result = await this.context.admin.requestJSON(
                    `/api/charts/${chartId}/redirects/new`,
                    { slug: this.slug },
                    "POST",
                    { onFailure: "continue" }
                )
                const redirect = result.redirect as ChartRedirect
                runInAction(() => {
                    this.isLoading = false
                    this.slug = ""
                    this.errorMessage = undefined
                })
                this.props.onSuccess(redirect)
            } catch (error) {
                runInAction(() => {
                    this.isLoading = false
                    this.errorMessage = stringifyUnknownError(error)
                })
            }
        }
    }

    render() {
        return (
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    void this.onSubmit()
                }}
            >
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text" id="basic-addon3">
                            {BASE_URL}/
                        </span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="URL"
                        value={this.slug}
                        onChange={(event) => this.onChange(event.target.value)}
                    />
                    <div className="input-group-append">
                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={!this.slug || this.isLoading}
                        >
                            Add
                        </button>
                    </div>
                </div>
                {this.errorMessage && (
                    <div className="alert alert-danger">
                        {this.errorMessage}
                    </div>
                )}
            </form>
        )
    }
}

@observer
export class EditorReferencesTabForIndicator extends Component<{
    editor: IndicatorChartEditor
}> {
    render() {
        const { references } = this.props.editor

        const publishedChildren = references?.childCharts ?? []
        const [chartsInheritanceEnabled, chartsInheritanceDisabled] = partition(
            publishedChildren,
            (chart) => chart.isInheritanceEnabled
        )

        const renderChartList = (charts: IndicatorChartInfo[]) => (
            <ul>
                {charts.map((chart) => (
                    <li key={chart.id}>
                        <a
                            href={`/admin/charts/${chart.id}/edit`}
                            target="_blank"
                            rel="noopener"
                        >
                            {chart.title ?? "Missing title"}
                        </a>{" "}
                        <span style={{ color: "#aaa" }}>
                            {chart.variantName && `(${chart.variantName})`}
                        </span>
                    </li>
                ))}
            </ul>
        )

        return (
            <Section name="Inheriting charts">
                <p>
                    Published charts that inherit from this indicator:{" "}
                    {chartsInheritanceEnabled.length === 0 && <i>None</i>}
                </p>

                {chartsInheritanceEnabled.length > 0 &&
                    renderChartList(chartsInheritanceEnabled)}

                <p>
                    Published charts that may inherit from this indicator, but
                    inheritance is currently disabled:{" "}
                    {chartsInheritanceDisabled.length === 0 && <i>None</i>}
                </p>

                {chartsInheritanceDisabled.length > 0 &&
                    renderChartList(chartsInheritanceDisabled)}
            </Section>
        )
    }
}
