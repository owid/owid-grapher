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
    ComponentRegistry,
    ComponentUsage,
    GdocsReferenceUsage,
    OwidGdocType,
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
import {
    sidecarNotesMarkdown,
    splitSidecarBody,
} from "./gdocsReferenceSidecar.js"
import {
    componentsUsedInTemplate,
    ScopedNavComponent,
} from "./gdocsReferenceNav.js"
import {
    ComponentForms,
    ExemplarXray,
    FrequencyBadge,
    PropTypeLinks,
    SkeletonScaffold,
    TemplateComponentShortlist,
    UsageSummary,
} from "./GdocsReferenceLive.js"
import {
    docTypeNoun,
    githubBlobUrl,
    githubEditUrl,
    overallUsageLabel,
    usageTooltip,
} from "./gdocsReferenceLiveHelpers.js"

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
    // Source file of every named type the prop type texts mention, from the
    // generated registry — lets the properties table link a type name to its
    // definition.
    typeSources: Record<string, string> = {}
    searchInput: string = ""
    // Live usage aggregate; null when the lookup failed (the page then falls
    // back to alphabetical ordering and shows no usage strips).
    usage: GdocsReferenceUsage | undefined | null = undefined
    // The template scoping the nav's component list. Visiting a template page
    // engages it, and it sticks while the author hops between that template's
    // blocks — "Show all" is the way out.
    navTemplateId: string | undefined = undefined

    private readonly searchFieldRef = createRef<HTMLInputElement>()
    private readonly contentRef = createRef<HTMLDivElement>()

    constructor(props: RouteComponentProps<ReferenceRouteParams>) {
        super(props)
        makeObservable(this, {
            components: observable,
            templates: observable,
            typeSources: observable,
            searchInput: observable,
            usage: observable,
            navTemplateId: observable,
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

    // What the properties table links a type name to: the component's own
    // reference page when the type is a block, its GitHub definition otherwise.
    @computed private get propTypeLinks(): PropTypeLinks {
        return {
            componentIdByTypeName: new Map(
                this.components.map((doc) => [doc.typeName, doc.id])
            ),
            typeSources: this.typeSources,
        }
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

    @computed private get usageByComponentId(): Map<string, ComponentUsage> {
        const map = new Map<string, ComponentUsage>()
        for (const usage of this.usage?.components ?? [])
            map.set(usage.componentId, usage)
        return map
    }

    private usageOf(doc: ComponentDoc): ComponentUsage | undefined {
        return this.usageByComponentId.get(doc.id)
    }

    // Live adoption first, alphabetical as tiebreak — and the whole ordering
    // degrades to alphabetical when the usage lookup is unavailable.
    private sortByUsage(docs: ComponentDoc[]): ComponentDoc[] {
        return [...docs].sort(
            (a, b) =>
                (this.usageOf(b)?.docsUsingIt ?? 0) -
                    (this.usageOf(a)?.docsUsingIt ?? 0) ||
                a.title.localeCompare(b.title)
        )
    }

    // System (platform) blocks never greet an author — they live in a
    // collapsed group at the end of the nav and the overview.
    @computed private get componentsByCategory(): {
        category: ComponentCategory
        components: ComponentDoc[]
    }[] {
        return COMPONENT_CATEGORIES.map((category) => ({
            category,
            components: this.sortByUsage(
                this.filteredComponents.filter(
                    (doc) => doc.category === category && !doc.system
                )
            ),
        })).filter((group) => group.components.length > 0)
    }

    @computed private get systemComponents(): ComponentDoc[] {
        return this.sortByUsage(
            this.filteredComponents.filter((doc) => doc.system)
        )
    }

    @action.bound private onSearch(value: string): void {
        this.searchInput = value
    }

    @action.bound private scopeNavToTemplate(id: string): void {
        this.navTemplateId = id
    }

    @action.bound private clearNavScope(): void {
        this.navTemplateId = undefined
    }

    // The template actually scoping the nav: engaged by visiting a template
    // page, dependent on the usage layer (without it there is no "used in"),
    // and inert when the id no longer resolves to a template.
    @computed private get navScopeTemplate(): TemplateDoc | undefined {
        if (!this.usage || !this.navTemplateId) return undefined
        return this.templates.find((doc) => doc.id === this.navTemplateId)
    }

    @computed
    private get scopedNavComponents(): ScopedNavComponent<ComponentDoc>[] {
        if (!this.navScopeTemplate) return []
        return componentsUsedInTemplate(
            this.filteredComponents,
            this.usage,
            this.navScopeTemplate.id
        )
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

    // Rows are quiet: the name only — the block tag already lives on the
    // component page and in Copy. Frequency dots appear only in the scoped
    // list, where they have a document type to be relative to.
    private renderNavItem(
        kind: Selection["kind"],
        doc: { id: string; title: string; system?: boolean },
        badge?: React.ReactElement
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
                    onClick={
                        kind === "templates"
                            ? (): void => this.scopeNavToTemplate(doc.id)
                            : undefined
                    }
                >
                    <span className="gdocs-ref__nav-item-title">
                        {doc.title}
                    </span>
                    {badge}
                </Link>
            </li>
        )
    }

    // The scoped rail: a banner naming the template, the blocks used in it
    // most-adopted first with dots scaled to that document type, and the way
    // back to the full list.
    private renderScopedNavList(template: TemplateDoc): React.ReactElement {
        return (
            <>
                <div className="gdocs-ref__nav-filter">
                    <span className="gdocs-ref__nav-filter-label">
                        Blocks used in <strong>{template.title}</strong>
                    </span>
                    <button
                        type="button"
                        className="gdocs-ref__nav-filter-clear"
                        onClick={this.clearNavScope}
                    >
                        Show all ×
                    </button>
                </div>
                <div className="gdocs-ref__nav-group">
                    <ul>
                        {this.scopedNavComponents.map(({ doc, entry }) =>
                            this.renderNavItem(
                                "components",
                                doc,
                                <FrequencyBadge
                                    label={entry.label}
                                    title={`${entry.docsUsingIt} of ${
                                        entry.totalDocs
                                    } ${docTypeNoun(
                                        entry.docType,
                                        entry.totalDocs !== 1
                                    )}`}
                                    hideWord
                                />
                            )
                        )}
                    </ul>
                </div>
                <button
                    type="button"
                    className="gdocs-ref__nav-show-all"
                    onClick={this.clearNavScope}
                >
                    Show all {this.components.length} components →
                </button>
            </>
        )
    }

    private renderRestingNavGroups(): React.ReactElement {
        const { componentsByCategory, systemComponents, query } = this
        return (
            <>
                {componentsByCategory.map(({ category, components }, index) => (
                    <div className="gdocs-ref__nav-group" key={category}>
                        <div className="gdocs-ref__nav-group-title">
                            {category}
                        </div>
                        {index === 0 && this.usage && !query && (
                            <div className="gdocs-ref__nav-hint">
                                Pick a template above to see how often each
                                block is used in it.
                            </div>
                        )}
                        <ul>
                            {components.map((doc) =>
                                this.renderNavItem("components", doc)
                            )}
                        </ul>
                    </div>
                ))}
                {systemComponents.length > 0 && (
                    <details
                        className="gdocs-ref__nav-group gdocs-ref__nav-group--system"
                        open={!!query}
                    >
                        <summary className="gdocs-ref__nav-group-title">
                            Platform blocks
                        </summary>
                        <ul>
                            {systemComponents.map((doc) =>
                                this.renderNavItem("components", doc)
                            )}
                        </ul>
                    </details>
                )}
            </>
        )
    }

    private renderNav(): React.ReactElement {
        const {
            filteredTemplates,
            componentsByCategory,
            systemComponents,
            navScopeTemplate,
            query,
        } = this
        const nothingMatches =
            query &&
            filteredTemplates.length === 0 &&
            (navScopeTemplate
                ? this.scopedNavComponents.length === 0
                : componentsByCategory.length === 0 &&
                  systemComponents.length === 0)
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
                {navScopeTemplate
                    ? this.renderScopedNavList(navScopeTemplate)
                    : this.renderRestingNavGroups()}
                {nothingMatches && (
                    <div className="gdocs-ref__nav-empty">
                        Nothing matches “{this.searchInput.trim()}”
                    </div>
                )}
            </nav>
        )
    }

    // The frequency an overview card carries, on the shared four-dot
    // vocabulary: its best adoption label across doc types, or "new" when it
    // exists in the registry but no published doc uses it yet (and it is not
    // a platform block).
    private renderUsageBadge(doc: ComponentDoc): React.ReactElement | null {
        if (!this.usage || doc.system) return null
        const usage = this.usageOf(doc)
        if (!usage)
            return (
                <span className="gdocs-ref__badge gdocs-ref__badge--new">
                    new — not yet used
                </span>
            )
        return (
            <FrequencyBadge
                label={overallUsageLabel(usage)}
                title={usageTooltip(usage)}
                hideWord
            />
        )
    }

    private renderComponentCard(doc: ComponentDoc): React.ReactElement {
        return (
            <Link
                key={doc.id}
                className="gdocs-ref__card"
                to={`/gdocs-reference/components/${doc.id}`}
            >
                <div className="gdocs-ref__card-title">
                    {doc.title}
                    {this.renderUsageBadge(doc)}
                </div>
                <code className="gdocs-ref__card-id">{`{.${doc.id}}`}</code>
                <p className="gdocs-ref__card-desc">
                    <InlineMarkdownText text={firstParagraph(doc.body)} />
                </p>
            </Link>
        )
    }

    // How much of our published content a doc type accounts for, in words —
    // the raw count lives in the tooltip.
    private templateContext(doc: TemplateDoc): React.ReactElement | null {
        const totals = this.usage?.totalDocsByType
        if (!totals) return null
        const allDocs = Object.values(totals).reduce(
            (sum, count) => sum + (count ?? 0),
            0
        )
        const count = totals[doc.id as OwidGdocType] ?? 0
        if (allDocs === 0) return null
        const share = count / allDocs
        const phrase =
            count === 0
                ? "not yet published"
                : share >= 0.3
                  ? "most of our published content"
                  : share >= 0.05
                    ? "a regular format"
                    : "an occasional format"
        return (
            <span
                className="gdocs-ref__card-context"
                title={`${count} published ${docTypeNoun(
                    doc.id as OwidGdocType,
                    count !== 1
                )}`}
            >
                {phrase}
            </span>
        )
    }

    private renderTemplateCard(doc: TemplateDoc): React.ReactElement {
        return (
            <Link
                key={doc.id}
                className="gdocs-ref__card gdocs-ref__card--template"
                to={`/gdocs-reference/templates/${doc.id}`}
            >
                <div className="gdocs-ref__card-title">
                    {doc.title}
                    {this.templateContext(doc)}
                </div>
                <code className="gdocs-ref__card-id">{`type: ${doc.id}`}</code>
                <p className="gdocs-ref__card-desc">
                    <InlineMarkdownText text={firstParagraph(doc.body)} />
                </p>
            </Link>
        )
    }

    private renderOverview(): React.ReactElement {
        const {
            filteredTemplates,
            componentsByCategory,
            systemComponents,
            components,
            query,
        } = this
        const nothingMatches =
            query &&
            filteredTemplates.length === 0 &&
            componentsByCategory.length === 0 &&
            systemComponents.length === 0
        return (
            <div className="gdocs-ref__overview">
                <h1 className="gdocs-ref__page-title">Writing reference</h1>
                <p className="gdocs-ref__intro">
                    Everything you can use when writing our content in Google
                    Docs. Start from the kind of document you are writing, or
                    browse the building blocks — every example is rendered
                    exactly as it will appear on the site, and the guidance is
                    grounded in how our published content actually uses each
                    block.
                </p>
                {nothingMatches && (
                    <p className="gdocs-ref__empty">
                        Nothing matches “{this.searchInput.trim()}” — try a
                        component id (e.g. <code>chart</code>) or a word from
                        its description.
                    </p>
                )}
                {filteredTemplates.length > 0 && (
                    <section className="gdocs-ref__section gdocs-ref__section--entry">
                        <h2 className="gdocs-ref__section-title">
                            What are you writing?
                        </h2>
                        <p className="gdocs-ref__section-desc">
                            Each template page shows the canonical structure of
                            that kind of document, how a real published one is
                            built, and the blocks it actually uses.
                        </p>
                        <div className="gdocs-ref__card-grid">
                            {filteredTemplates.map((doc) =>
                                this.renderTemplateCard(doc)
                            )}
                        </div>
                    </section>
                )}
                {componentsByCategory.length > 0 && (
                    <section className="gdocs-ref__section gdocs-ref__section--entry">
                        <h2 className="gdocs-ref__section-title">
                            Building blocks
                        </h2>
                        <p className="gdocs-ref__section-desc">
                            Every component that can go in a document body,
                            most-used first. Each page says when to reach for it
                            — and when a different block serves better.
                        </p>
                    </section>
                )}
                {componentsByCategory.map(({ category, components: docs }) => (
                    <section className="gdocs-ref__section" key={category}>
                        <h3 className="gdocs-ref__section-subtitle">
                            {category}
                            <span className="gdocs-ref__section-count">
                                {docs.length}
                            </span>
                        </h3>
                        <div className="gdocs-ref__card-grid">
                            {docs.map((doc) => this.renderComponentCard(doc))}
                        </div>
                    </section>
                ))}
                {systemComponents.length > 0 && (
                    <details
                        className="gdocs-ref__system-details"
                        open={!!query}
                    >
                        <summary>
                            Platform blocks ({systemComponents.length}) —
                            rendered on pages the team manages, not part of the
                            authoring vocabulary
                        </summary>
                        <div className="gdocs-ref__card-grid">
                            {systemComponents.map((doc) =>
                                this.renderComponentCard(doc)
                            )}
                        </div>
                    </details>
                )}
                {!query && components.length > 0 && (
                    <p className="gdocs-ref__footnote">
                        {components.length} components · {this.templates.length}{" "}
                        templates. The docs are generated from the type
                        definitions in the codebase; usage guidance and real
                        examples are computed live from published content.
                    </p>
                )}
            </div>
        )
    }

    // The "When to use" / "When NOT to use" prose rendered as a decision box
    // — the choose-this-not-that guidance an author needs before anything
    // else, with the related-component mentions linked.
    private renderDecisionBox(
        whenToUse: string | undefined,
        whenNotToUse: string | undefined,
        previewPathForExample: (index: number) => string | undefined,
        examples: ComponentDoc["examples"]
    ): React.ReactElement | null {
        if (!whenToUse && !whenNotToUse) return null
        return (
            <div className="gdocs-ref__decision">
                {whenToUse && (
                    <div className="gdocs-ref__decision-panel gdocs-ref__decision-panel--use">
                        <h2 className="gdocs-ref__decision-title">
                            Use it for
                        </h2>
                        <GdocsReferenceMarkdown
                            body={whenToUse}
                            examples={examples}
                            previewPathForExample={previewPathForExample}
                            componentIds={this.componentIds}
                        />
                    </div>
                )}
                {whenNotToUse && (
                    <div className="gdocs-ref__decision-panel gdocs-ref__decision-panel--avoid">
                        <h2 className="gdocs-ref__decision-title">
                            Reach for something else when
                        </h2>
                        <GdocsReferenceMarkdown
                            body={whenNotToUse}
                            examples={examples}
                            previewPathForExample={previewPathForExample}
                            componentIds={this.componentIds}
                        />
                    </div>
                )}
            </div>
        )
    }

    private renderComponentDetail(doc: ComponentDoc): React.ReactElement {
        const { intro, whenToUse, whenNotToUse, rest } = splitSidecarBody(
            doc.body
        )
        const previewPath = this.previewPathForComponent(doc)
        // The sidecar's remaining prose renders as authored notes under the
        // derived properties table. Examples live in the intro by convention
        // (generator-enforced) and render there, in place.
        const notesMarkdown = sidecarNotesMarkdown(rest)
        return (
            <article className="gdocs-ref__detail">
                <header className="gdocs-ref__detail-header">
                    <div className="gdocs-ref__detail-title-row">
                        <h1 className="gdocs-ref__detail-title">{doc.title}</h1>
                        <span className="gdocs-ref__category-pill">
                            {doc.system ? "Platform block" : doc.category}
                        </span>
                    </div>
                </header>
                {intro && (
                    <GdocsReferenceMarkdown
                        body={intro}
                        examples={doc.examples}
                        previewPathForExample={previewPath}
                        componentIds={this.componentIds}
                    />
                )}
                {this.renderDecisionBox(
                    whenToUse,
                    whenNotToUse,
                    previewPath,
                    doc.examples
                )}
                {this.usage && !doc.system && (
                    <UsageSummary
                        usage={this.usageOf(doc)}
                        totalDocsByType={this.usage.totalDocsByType}
                        templateIds={
                            new Set(
                                this.templates.map((template) => template.id)
                            )
                        }
                    />
                )}
                <ComponentForms
                    doc={doc}
                    usage={this.usageOf(doc)}
                    typeLinks={this.propTypeLinks}
                    notes={
                        notesMarkdown ? (
                            <GdocsReferenceMarkdown
                                body={notesMarkdown}
                                examples={doc.examples}
                                previewPathForExample={previewPath}
                                componentIds={this.componentIds}
                            />
                        ) : undefined
                    }
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
        const { intro, whenToUse, whenNotToUse, rest } = splitSidecarBody(
            doc.body
        )
        const previewPath = this.previewPathForTemplate(doc)
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
                {intro && (
                    <GdocsReferenceMarkdown
                        body={intro}
                        examples={doc.examples}
                        previewPathForExample={previewPath}
                        componentIds={this.componentIds}
                    />
                )}
                {this.renderDecisionBox(
                    whenToUse,
                    whenNotToUse,
                    previewPath,
                    doc.examples
                )}
                <SkeletonScaffold template={doc} />
                <ExemplarXray template={doc} />
                <TemplateComponentShortlist
                    template={doc}
                    usage={this.usage}
                    components={this.components}
                />
                {rest && (
                    <GdocsReferenceMarkdown
                        body={rest}
                        examples={doc.examples}
                        previewPathForExample={previewPath}
                        componentIds={this.componentIds}
                    />
                )}
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
        const [{ components, typeSources }, { templates }] = await Promise.all([
            admin.getJSON<ComponentRegistry>("/api/components.json"),
            admin.getJSON<{ templates: TemplateDoc[] }>("/api/templates.json"),
        ])
        runInAction(() => {
            this.components = components
            this.typeSources = typeSources
            this.templates = templates
        })
        // Loaded separately, and tolerated when it fails: the reference is
        // still fully usable without the live usage layer.
        try {
            const usage = await admin.getJSON<GdocsReferenceUsage>(
                "/api/gdocs-reference/usage.json"
            )
            runInAction(() => (this.usage = usage))
        } catch {
            runInAction(() => (this.usage = null))
        }
    }

    // Landing on a template page (direct link, back/forward) engages the nav
    // scope just as clicking the template does.
    private syncNavScopeToRoute(): void {
        if (this.selection?.kind === "templates")
            this.scopeNavToTemplate(this.selection.id)
    }

    override componentDidMount(): void {
        void this.getData()
        document.addEventListener("keydown", this.onGlobalKeyDown)
        this.syncNavScopeToRoute()
    }

    override componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onGlobalKeyDown)
    }

    override componentDidUpdate(
        prevProps: RouteComponentProps<ReferenceRouteParams>
    ): void {
        const prev = prevProps.match.params
        const current = this.props.match.params
        if (prev.kind !== current.kind || prev.id !== current.id) {
            this.contentRef.current?.scrollTo({ top: 0 })
            this.syncNavScopeToRoute()
        }
    }
}
