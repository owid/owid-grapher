import { Component, createRef } from "react"
import { observer } from "mobx-react"
import { observable, action, computed, runInAction, makeObservable } from "mobx"
import { RouteComponentProps } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCode,
    faMagnifyingGlass,
    faPenToSquare,
} from "@fortawesome/free-solid-svg-icons"
import {
    COMPONENT_CATEGORIES,
    ComponentCategory,
    ComponentDoc,
    TemplateDoc,
    TemplateFieldDoc,
} from "@ourworldindata/types"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Link } from "./Link.js"
import {
    GdocsReferenceMarkdown,
    InlineMarkdownText,
} from "./GdocsReferenceMarkdown.js"
import { CopyButton } from "./GdocsReferenceExample.js"

// Component docs live as .md sidecars in the repo, gated by CI; the detail
// view links technical editors to the GitHub web editor to propose changes.
const GITHUB_REPO = "https://github.com/owid/owid-grapher"
const githubEditUrl = (sidecarFile: string): string =>
    `${GITHUB_REPO}/edit/master/${sidecarFile}`
const githubBlobUrl = (sourceFile: string): string =>
    `${GITHUB_REPO}/blob/master/${sourceFile}`

const TEMPLATES_GROUP_TITLE = "Document templates"

// First paragraph of the markdown body, used as the card description.
function firstParagraph(body: string): string {
    return (body.split("\n\n")[0] ?? "").replace(/\s+/g, " ").trim()
}

function matchesSearch(haystackParts: string[], query: string): boolean {
    return haystackParts.join("\n").toLowerCase().includes(query)
}

// Relevance of a doc for the query, for Enter-to-open: name matches beat
// matches buried in the body text.
function searchScore(
    doc: { id: string; title: string; body: string },
    query: string
): number {
    const id = doc.id.toLowerCase()
    const title = doc.title.toLowerCase()
    if (id === query || title === query) return 100
    if (id.startsWith(query) || title.startsWith(query)) return 80
    if (id.includes(query) || title.includes(query)) return 60
    return 10
}

type ReferenceRouteParams = { kind?: string; id?: string }

interface Selection {
    kind: "components" | "templates"
    id: string
}

@observer
export class GdocsReferencePage extends Component<
    RouteComponentProps<ReferenceRouteParams>
> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    components: ComponentDoc[] = []
    templates: TemplateDoc[] = []
    searchInput: string = ""

    private readonly searchFieldRef = createRef<HTMLInputElement>()
    private readonly contentRef = createRef<HTMLDivElement>()

    constructor(props: RouteComponentProps<ReferenceRouteParams>) {
        super(props)
        makeObservable(this, {
            components: observable,
            templates: observable,
            searchInput: observable,
        })
    }

    @computed private get selection(): Selection | undefined {
        const { kind, id } = this.props.match.params
        if (!id) return undefined
        if (kind === "components" || kind === "templates") return { kind, id }
        return undefined
    }

    @computed private get selectedComponent(): ComponentDoc | undefined {
        if (this.selection?.kind !== "components") return undefined
        const { id } = this.selection
        return this.components.find((doc) => doc.id === id)
    }

    @computed private get selectedTemplate(): TemplateDoc | undefined {
        if (this.selection?.kind !== "templates") return undefined
        const { id } = this.selection
        return this.templates.find((doc) => doc.id === id)
    }

    @computed private get componentIds(): Set<string> {
        return new Set(this.components.map((doc) => doc.id))
    }

    @computed private get query(): string {
        return this.searchInput.trim().toLowerCase()
    }

    @computed private get filteredComponents(): ComponentDoc[] {
        if (!this.query) return this.components
        return this.components.filter((doc) =>
            matchesSearch(
                [doc.title, doc.id, doc.typeName, doc.category, doc.body],
                this.query
            )
        )
    }

    @computed private get filteredTemplates(): TemplateDoc[] {
        if (!this.query) return this.templates
        return this.templates.filter((doc) =>
            matchesSearch([doc.title, doc.id, doc.body], this.query)
        )
    }

    @computed private get componentsByCategory(): {
        category: ComponentCategory
        components: ComponentDoc[]
    }[] {
        return COMPONENT_CATEGORIES.map((category) => ({
            category,
            components: this.filteredComponents.filter(
                (doc) => doc.category === category
            ),
        })).filter((group) => group.components.length > 0)
    }

    @action.bound private onSearch(value: string): void {
        this.searchInput = value
    }

    private readonly onSearchKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ): void => {
        if (event.key === "Escape") {
            this.onSearch("")
            this.searchFieldRef.current?.blur()
        }
        if (event.key === "Enter" && this.query) {
            const best = this.bestMatch
            if (best)
                this.props.history.push(
                    `/gdocs-reference/${best.kind}/${best.id}`
                )
        }
    }

    // The most relevant match across templates and components, opened on
    // Enter in the search field.
    @computed private get bestMatch(): Selection | undefined {
        const { query } = this
        if (!query) return undefined
        const candidates: (Selection & { score: number })[] = [
            ...this.filteredTemplates.map((doc) => ({
                kind: "templates" as const,
                id: doc.id,
                score: searchScore(doc, query),
            })),
            ...this.filteredComponents.map((doc) => ({
                kind: "components" as const,
                id: doc.id,
                score: searchScore(doc, query),
            })),
        ]
        if (candidates.length === 0) return undefined
        return candidates.reduce((best, candidate) =>
            candidate.score > best.score ? candidate : best
        )
    }

    private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
        const isCmdK = (event.metaKey || event.ctrlKey) && event.key === "k"
        const target = event.target as HTMLElement | null
        const isTyping =
            target &&
            (target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable)
        const isSlash = event.key === "/" && !isTyping
        if (isCmdK || isSlash) {
            event.preventDefault()
            this.searchFieldRef.current?.focus()
            this.searchFieldRef.current?.select()
        }
    }

    private previewPathForComponent(doc: ComponentDoc) {
        return (exampleIndex: number): string =>
            `/gdocs-reference/components/${doc.id}/preview?example=${exampleIndex}`
    }

    private previewPathForTemplate(doc: TemplateDoc) {
        return (exampleIndex: number): string =>
            `/gdocs-reference/templates/${doc.id}/preview?example=${exampleIndex}`
    }

    private renderNavItem(
        kind: Selection["kind"],
        doc: { id: string; title: string }
    ): React.ReactElement {
        const isActive =
            this.selection?.kind === kind && this.selection.id === doc.id
        return (
            <li key={`${kind}-${doc.id}`}>
                <Link
                    className={
                        isActive
                            ? "gdocs-ref__nav-item gdocs-ref__nav-item--active"
                            : "gdocs-ref__nav-item"
                    }
                    to={`/gdocs-reference/${kind}/${doc.id}`}
                >
                    <span className="gdocs-ref__nav-item-title">
                        {doc.title}
                    </span>
                    <code className="gdocs-ref__nav-item-id">
                        {kind === "components" ? `{.${doc.id}}` : doc.id}
                    </code>
                </Link>
            </li>
        )
    }

    private renderNav(): React.ReactElement {
        const { filteredTemplates, componentsByCategory, query } = this
        const nothingMatches =
            query &&
            filteredTemplates.length === 0 &&
            componentsByCategory.length === 0
        return (
            <nav className="gdocs-ref__nav">
                <div className="gdocs-ref__search">
                    <FontAwesomeIcon
                        icon={faMagnifyingGlass}
                        className="gdocs-ref__search-icon"
                    />
                    <input
                        ref={this.searchFieldRef}
                        className="gdocs-ref__search-input"
                        type="search"
                        placeholder="Search the docs… ( / )"
                        value={this.searchInput}
                        onChange={(event) =>
                            this.onSearch(event.currentTarget.value)
                        }
                        onKeyDown={this.onSearchKeyDown}
                    />
                </div>
                <Link className="gdocs-ref__nav-overview" to="/gdocs-reference">
                    Overview
                </Link>
                {filteredTemplates.length > 0 && (
                    <div className="gdocs-ref__nav-group">
                        <div className="gdocs-ref__nav-group-title">
                            {TEMPLATES_GROUP_TITLE}
                        </div>
                        <ul>
                            {filteredTemplates.map((doc) =>
                                this.renderNavItem("templates", doc)
                            )}
                        </ul>
                    </div>
                )}
                {componentsByCategory.map(({ category, components }) => (
                    <div className="gdocs-ref__nav-group" key={category}>
                        <div className="gdocs-ref__nav-group-title">
                            {category}
                        </div>
                        <ul>
                            {components.map((doc) =>
                                this.renderNavItem("components", doc)
                            )}
                        </ul>
                    </div>
                ))}
                {nothingMatches && (
                    <div className="gdocs-ref__nav-empty">
                        Nothing matches “{this.searchInput.trim()}”
                    </div>
                )}
            </nav>
        )
    }

    private renderComponentCard(doc: ComponentDoc): React.ReactElement {
        return (
            <Link
                key={doc.id}
                className="gdocs-ref__card"
                to={`/gdocs-reference/components/${doc.id}`}
            >
                <div className="gdocs-ref__card-title">{doc.title}</div>
                <code className="gdocs-ref__card-id">{`{.${doc.id}}`}</code>
                <p className="gdocs-ref__card-desc">
                    <InlineMarkdownText text={firstParagraph(doc.body)} />
                </p>
            </Link>
        )
    }

    private renderTemplateCard(doc: TemplateDoc): React.ReactElement {
        return (
            <Link
                key={doc.id}
                className="gdocs-ref__card gdocs-ref__card--template"
                to={`/gdocs-reference/templates/${doc.id}`}
            >
                <div className="gdocs-ref__card-title">{doc.title}</div>
                <code className="gdocs-ref__card-id">{`type: ${doc.id}`}</code>
                <p className="gdocs-ref__card-desc">
                    <InlineMarkdownText text={firstParagraph(doc.body)} />
                </p>
            </Link>
        )
    }

    private renderOverview(): React.ReactElement {
        const { filteredTemplates, componentsByCategory, components, query } =
            this
        const nothingMatches =
            query &&
            filteredTemplates.length === 0 &&
            componentsByCategory.length === 0
        return (
            <div className="gdocs-ref__overview">
                <h1 className="gdocs-ref__page-title">Writing reference</h1>
                <p className="gdocs-ref__intro">
                    Everything you can use when writing our content in Google
                    Docs: a template for each type of document, and every
                    ArchieML component that can go in a document body — with
                    copy-paste examples rendered exactly as they will appear on
                    the site.
                </p>
                {nothingMatches && (
                    <p className="gdocs-ref__empty">
                        Nothing matches “{this.searchInput.trim()}” — try a
                        component id (e.g. <code>chart</code>) or a word from
                        its description.
                    </p>
                )}
                {filteredTemplates.length > 0 && (
                    <section className="gdocs-ref__section">
                        <h2 className="gdocs-ref__section-title">
                            {TEMPLATES_GROUP_TITLE}
                        </h2>
                        <p className="gdocs-ref__section-desc">
                            Starting a new document? Each template shows the
                            canonical structure for that type of content — front
                            matter, body, and a full example you can copy into a
                            fresh Google Doc.
                        </p>
                        <div className="gdocs-ref__card-grid">
                            {filteredTemplates.map((doc) =>
                                this.renderTemplateCard(doc)
                            )}
                        </div>
                    </section>
                )}
                {componentsByCategory.map(({ category, components: docs }) => (
                    <section className="gdocs-ref__section" key={category}>
                        <h2 className="gdocs-ref__section-title">
                            {category}
                            <span className="gdocs-ref__section-count">
                                {docs.length}
                            </span>
                        </h2>
                        <div className="gdocs-ref__card-grid">
                            {docs.map((doc) => this.renderComponentCard(doc))}
                        </div>
                    </section>
                ))}
                {!query && components.length > 0 && (
                    <p className="gdocs-ref__footnote">
                        {components.length} components · {this.templates.length}{" "}
                        templates. This reference is generated from the type
                        definitions and their documentation in the codebase —
                        every example is validated by CI against the same parser
                        that ingests real documents.
                    </p>
                )}
            </div>
        )
    }

    private renderComponentDetail(doc: ComponentDoc): React.ReactElement {
        return (
            <article className="gdocs-ref__detail">
                <header className="gdocs-ref__detail-header">
                    <div className="gdocs-ref__detail-title-row">
                        <h1 className="gdocs-ref__detail-title">{doc.title}</h1>
                        <span className="gdocs-ref__category-pill">
                            {doc.category}
                        </span>
                    </div>
                    <div className="gdocs-ref__detail-id-row">
                        <code className="gdocs-ref__detail-id">{`{.${doc.id}}`}</code>
                        <CopyButton
                            text={`{.${doc.id}}`}
                            className="gdocs-ref__chip-copy"
                        />
                    </div>
                </header>
                <GdocsReferenceMarkdown
                    body={doc.body}
                    examples={doc.examples}
                    previewPathForExample={this.previewPathForComponent(doc)}
                    componentIds={this.componentIds}
                />
                {doc.examples.length === 0 && (
                    <p className="gdocs-ref__note">
                        This component has no standalone ArchieML example — it
                        only appears nested inside other components.
                    </p>
                )}
                <footer className="gdocs-ref__detail-footer">
                    <a
                        href={githubEditUrl(doc.sidecarFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faPenToSquare} /> Suggest an edit
                        to this page
                    </a>
                    <a
                        href={githubBlobUrl(doc.sourceFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faCode} /> View type definition (
                        {doc.typeName})
                    </a>
                </footer>
            </article>
        )
    }

    private renderTemplateFields(doc: TemplateDoc): React.ReactElement {
        const authored = doc.fields.filter(
            (field) => field.writeBack === "emitted"
        )
        const derived = doc.fields.filter(
            (field) => field.writeBack !== "emitted"
        )
        const renderRow = (field: TemplateFieldDoc): React.ReactElement => (
            <tr key={field.name}>
                <td>
                    <code>{field.name}</code>
                    {!field.optional && (
                        <span className="gdocs-ref__required-badge">
                            required
                        </span>
                    )}
                </td>
                <td>
                    <code className="gdocs-ref__field-type">{field.type}</code>
                </td>
                <td>
                    {field.description && (
                        <InlineMarkdownText text={field.description} />
                    )}
                </td>
            </tr>
        )
        return (
            <section className="gdocs-ref__section">
                <h2 className="gdocs-ref__section-title">
                    Front matter reference
                </h2>
                <p className="gdocs-ref__section-desc">
                    The keys you can set at the top of the document, before{" "}
                    <code>[+body]</code>.
                </p>
                <table className="gdocs-ref__fields-table">
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>{authored.map(renderRow)}</tbody>
                </table>
                {derived.length > 0 && (
                    <details className="gdocs-ref__derived-fields">
                        <summary>
                            {derived.length} computed fields (never written by
                            authors)
                        </summary>
                        <p>
                            These exist on the parsed document but are derived
                            from the content — you never write them:{" "}
                            {derived.map((field, index) => (
                                <span key={field.name}>
                                    {index > 0 && ", "}
                                    <code>{field.name}</code>
                                </span>
                            ))}
                        </p>
                    </details>
                )}
                {doc.adminManagedFields.length > 0 && (
                    <p className="gdocs-ref__admin-managed">
                        Managed in the admin, not in the document:{" "}
                        {doc.adminManagedFields.map((name, index) => (
                            <span key={name}>
                                {index > 0 && ", "}
                                <code>{name}</code>
                            </span>
                        ))}
                        .
                    </p>
                )}
            </section>
        )
    }

    private renderTemplateDetail(doc: TemplateDoc): React.ReactElement {
        return (
            <article className="gdocs-ref__detail">
                <header className="gdocs-ref__detail-header">
                    <div className="gdocs-ref__detail-title-row">
                        <h1 className="gdocs-ref__detail-title">{doc.title}</h1>
                        <span className="gdocs-ref__category-pill">
                            Document template
                        </span>
                    </div>
                    <div className="gdocs-ref__detail-id-row">
                        <code className="gdocs-ref__detail-id">{`type: ${doc.id}`}</code>
                    </div>
                </header>
                <GdocsReferenceMarkdown
                    body={doc.body}
                    examples={doc.examples}
                    previewPathForExample={this.previewPathForTemplate(doc)}
                    componentIds={this.componentIds}
                />
                {this.renderTemplateFields(doc)}
                <footer className="gdocs-ref__detail-footer">
                    <a
                        href={githubEditUrl(doc.sidecarFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faPenToSquare} /> Suggest an edit
                        to this page
                    </a>
                </footer>
            </article>
        )
    }

    private renderContent(): React.ReactElement {
        const { selection, selectedComponent, selectedTemplate } = this
        if (!selection) return this.renderOverview()
        if (selectedComponent)
            return this.renderComponentDetail(selectedComponent)
        if (selectedTemplate) return this.renderTemplateDetail(selectedTemplate)
        // Data still loading, or a dead link
        if (this.components.length === 0)
            return <div className="gdocs-ref__loading">Loading…</div>
        return (
            <div className="gdocs-ref__empty">
                No such page.{" "}
                <Link to="/gdocs-reference">Back to the overview.</Link>
            </div>
        )
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout title="Writing reference">
                <main className="gdocs-ref">
                    {this.renderNav()}
                    <div className="gdocs-ref__content" ref={this.contentRef}>
                        {this.renderContent()}
                    </div>
                </main>
            </AdminLayout>
        )
    }

    async getData(): Promise<void> {
        const { admin } = this.context
        const [{ components }, { templates }] = await Promise.all([
            admin.getJSON<{ components: ComponentDoc[] }>(
                "/api/components.json"
            ),
            admin.getJSON<{ templates: TemplateDoc[] }>("/api/templates.json"),
        ])
        runInAction(() => {
            this.components = components
            this.templates = templates
        })
    }

    override componentDidMount(): void {
        void this.getData()
        document.addEventListener("keydown", this.onGlobalKeyDown)
    }

    override componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onGlobalKeyDown)
    }

    override componentDidUpdate(
        prevProps: RouteComponentProps<ReferenceRouteParams>
    ): void {
        const prev = prevProps.match.params
        const current = this.props.match.params
        if (prev.kind !== current.kind || prev.id !== current.id)
            this.contentRef.current?.scrollTo({ top: 0 })
    }
}
