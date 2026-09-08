import { Component, createRef } from "react"
import { observer } from "mobx-react"
import { observable, action, computed, runInAction, makeObservable } from "mobx"
import { RouteComponentProps } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronRight,
    faCode,
    faMagnifyingGlass,
    faPenToSquare,
} from "@fortawesome/free-solid-svg-icons"
import {
    COMPONENT_CATEGORIES,
    ComponentCategory,
    ComponentReference,
    ComponentRegistry,
    ComponentUsage,
    GdocsReferenceUsage,
    OwidGdocType,
    proseText,
    TemplateReference,
    TemplateField,
} from "@ourworldindata/types"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Link } from "./Link.js"
import {
    GdocsReferenceMarkdown,
    InlineMarkdownText,
} from "./GdocsReferenceMarkdown.js"
import { sortTemplatesByUsage, stepHighlight } from "./gdocsReferenceNav.js"
import {
    ComponentForms,
    ExemplarPreview,
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
    item: { id: string; title: string },
    query: string
): number {
    const id = item.id.toLowerCase()
    const title = item.title.toLowerCase()
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

    components: ComponentReference[] = []
    templates: TemplateReference[] = []
    // Source file of every named type the prop type texts mention, from the
    // generated registry — lets the properties table link a type name to its
    // definition.
    typeSources: Record<string, string> = {}
    searchInput: string = ""
    // Live usage aggregate; null when the lookup failed (the page then falls
    // back to alphabetical ordering and shows no usage strips).
    usage: GdocsReferenceUsage | undefined | null = undefined
    // Which sidebar groups are unfolded: components — the bulk of the
    // reference — start open, the group of the page being viewed opens on
    // arrival, and the rest is the author's own toggling, kept while they
    // browse. A search query overrides this and shows every match.
    expandedNavGroups: Record<NavGroupKind, boolean> = {
        guides: false,
        templates: false,
        components: true,
    }
    // Index into `navResults` of the row the search keeps highlighted for
    // arrow-key navigation; undefined when nothing is highlighted (empty
    // query, or no match).
    highlightedIndex: number | undefined = undefined

    private readonly searchFieldRef = createRef<HTMLInputElement>()
    private readonly contentRef = createRef<HTMLDivElement>()
    // The row last scrolled into view, so it only happens when the
    // highlighted index actually changes, not on every render.
    private lastScrolledHighlightIndex: number | undefined = undefined

    constructor(props: RouteComponentProps<ReferenceRouteParams>) {
        super(props)
        makeObservable(this, {
            components: observable,
            templates: observable,
            typeSources: observable,
            searchInput: observable,
            usage: observable,
            expandedNavGroups: observable,
            highlightedIndex: observable,
        })
    }

    @computed private get selection(): Selection | undefined {
        const { kind, id } = this.props.match.params
        if (!id) return undefined
        if (kind === "components" || kind === "templates") return { kind, id }
        return undefined
    }

    @computed private get selectedComponent(): ComponentReference | undefined {
        if (this.selection?.kind !== "components") return undefined
        const { id } = this.selection
        return this.components.find((component) => component.id === id)
    }

    @computed private get selectedTemplate(): TemplateReference | undefined {
        if (this.selection?.kind !== "templates") return undefined
        const { id } = this.selection
        return this.templates.find((template) => template.id === id)
    }

    // What the properties table links a type name to: the component's own
    // reference page when the type is a block, its GitHub definition otherwise.
    @computed private get propTypeLinks(): PropTypeLinks {
        return {
            componentIdByTypeName: new Map(
                this.components.map((component) => [
                    component.typeName,
                    component.id,
                ])
            ),
            typeSources: this.typeSources,
        }
    }

    @computed private get query(): string {
        return this.searchInput.trim().toLowerCase()
    }

    @computed private get filteredComponents(): ComponentReference[] {
        if (!this.query) return this.components
        return this.components.filter((component) =>
            matchesSearch(
                [
                    component.title,
                    component.id,
                    component.typeName,
                    component.category,
                    proseText(component.prose),
                ],
                this.query
            )
        )
    }

    @computed private get filteredTemplates(): TemplateReference[] {
        const filtered = this.query
            ? this.templates.filter((template) =>
                  matchesSearch(
                      [template.title, template.id, proseText(template.prose)],
                      this.query
                  )
              )
            : this.templates
        return sortTemplatesByUsage(filtered, this.usage?.totalDocsByType)
    }

    @computed private get usageByComponentId(): Map<string, ComponentUsage> {
        const map = new Map<string, ComponentUsage>()
        for (const usage of this.usage?.components ?? [])
            map.set(usage.componentId, usage)
        return map
    }

    private usageOf(component: ComponentReference): ComponentUsage | undefined {
        return this.usageByComponentId.get(component.id)
    }

    // Live adoption first, alphabetical as tiebreak — and the whole ordering
    // degrades to alphabetical when the usage lookup is unavailable.
    private sortByUsage(
        components: ComponentReference[]
    ): ComponentReference[] {
        return [...components].sort(
            (a, b) =>
                Number(!!a.autoGenerated) - Number(!!b.autoGenerated) ||
                (this.usageOf(b)?.docsUsingIt ?? 0) -
                    (this.usageOf(a)?.docsUsingIt ?? 0) ||
                a.title.localeCompare(b.title)
        )
    }

    // System (platform) blocks never greet an author — they live in a
    // collapsed group at the end of the nav and the overview.
    @computed private get componentsByCategory(): {
        category: ComponentCategory
        components: ComponentReference[]
    }[] {
        return COMPONENT_CATEGORIES.map((category) => ({
            category,
            components: this.sortByUsage(
                this.filteredComponents.filter(
                    (component) =>
                        component.category === category && !component.system
                )
            ),
        })).filter((group) => group.components.length > 0)
    }

    @computed private get systemComponents(): ComponentReference[] {
        return this.sortByUsage(
            this.filteredComponents.filter((component) => component.system)
        )
    }

    @action.bound private onSearch(value: string): void {
        this.searchInput = value
        this.syncHighlightToBestMatch()
    }

    // Re-anchors the highlight whenever the query changes: to the best
    // match's row, or to nothing once the query is cleared.
    @action.bound private syncHighlightToBestMatch(): void {
        if (!this.query) {
            this.highlightedIndex = undefined
            return
        }
        const best = this.bestMatch
        const index = best
            ? this.navResults.findIndex(
                  (item) => item.kind === best.kind && item.id === best.id
              )
            : -1
        this.highlightedIndex = index === -1 ? undefined : index
    }

    @action.bound private moveHighlight(delta: 1 | -1): void {
        // Rows only step while a query keeps every group open — otherwise
        // the highlight could land inside a folded group.
        if (!this.query) return
        this.highlightedIndex = stepHighlight(
            this.highlightedIndex,
            delta,
            this.navResults.length
        )
    }

    @action.bound private toggleNavGroup(kind: NavGroupKind): void {
        this.expandedNavGroups = {
            ...this.expandedNavGroups,
            [kind]: !this.expandedNavGroups[kind],
        }
    }

    // Arriving on a page (click, direct link, back/forward) unfolds its
    // group — and only that one, so what the author folded stays folded.
    @action.bound private expandNavGroupOfSelection(): void {
        const kind = this.selection?.kind
        if (kind && !this.expandedNavGroups[kind])
            this.expandedNavGroups = { ...this.expandedNavGroups, [kind]: true }
    }

    private isNavGroupExpanded(kind: NavGroupKind): boolean {
        return !!this.query || this.expandedNavGroups[kind]
    }

    // The sidebar nav's rows in the exact order they render: templates, then
    // components — the scoped list while a template scopes the nav, otherwise
    // the resting category groups with system blocks last. Arrow-key stepping
    // and Enter-to-open both index into this.
    @computed private get navResults(): Selection[] {
        const templates: Selection[] = this.filteredTemplates.map(
            (template) => ({ kind: "templates", id: template.id })
        )
        const components: Selection[] = [
            ...this.componentsByCategory.flatMap(({ components }) =>
                components.map((component) => ({
                    kind: "components" as const,
                    id: component.id,
                }))
            ),
            ...this.systemComponents.map((component) => ({
                kind: "components" as const,
                id: component.id,
            })),
        ]
        return [...templates, ...components]
    }

    @computed private get highlightedItem(): Selection | undefined {
        return this.highlightedIndex !== undefined
            ? this.navResults[this.highlightedIndex]
            : undefined
    }

    private elementIdFor(kind: Selection["kind"], id: string): string {
        return `gdocs-ref-nav-${kind}-${id}`
    }

    private readonly onSearchKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ): void => {
        if (event.key === "Escape") {
            this.onSearch("")
            this.searchFieldRef.current?.blur()
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            this.moveHighlight(event.key === "ArrowDown" ? 1 : -1)
        }
        if (event.key === "Enter") {
            const target = this.highlightedItem ?? this.bestMatch
            if (target)
                this.props.history.push(
                    `/gdocs-reference/${target.kind}/${target.id}`
                )
        }
    }

    // The most relevant match across templates and components, opened on
    // Enter in the search field.
    @computed private get bestMatch(): Selection | undefined {
        const { query } = this
        if (!query) return undefined
        const candidates: (Selection & { score: number })[] = [
            ...this.filteredTemplates.map((template) => ({
                kind: "templates" as const,
                id: template.id,
                score: searchScore(template, query),
            })),
            ...this.filteredComponents.map((component) => ({
                kind: "components" as const,
                id: component.id,
                score: searchScore(component, query),
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

    private previewPathForComponent(component: ComponentReference) {
        return (exampleIndex: number): string =>
            `/gdocs-reference/components/${component.id}/preview?example=${exampleIndex}`
    }

    // Rows are quiet: the name only — the block tag already lives on the
    // component page and in Copy.
    private renderNavItem(
        kind: Selection["kind"],
        item: { id: string; title: string }
    ): React.ReactElement {
        const isActive =
            this.selection?.kind === kind && this.selection.id === item.id
        const isHighlighted =
            this.highlightedItem?.kind === kind &&
            this.highlightedItem.id === item.id
        const className = [
            "gdocs-ref__nav-item",
            isActive && "gdocs-ref__nav-item--active",
            isHighlighted && "gdocs-ref__nav-item--highlighted",
        ]
            .filter(Boolean)
            .join(" ")
        return (
            <li
                key={`${kind}-${item.id}`}
                id={this.elementIdFor(kind, item.id)}
                aria-selected={isHighlighted || undefined}
            >
                <Link
                    className={className}
                    to={`/gdocs-reference/${kind}/${item.id}`}
                    aria-current={isActive ? "page" : undefined}
                >
                    <span className="gdocs-ref__nav-item-title">
                        {item.title}
                    </span>
                </Link>
            </li>
        )
    }

    // A top-level group: a disclosure header (title and how many rows it
    // holds) over its rows. While a query is active the header is static —
    // every match shows, so there is nothing to fold.
    private renderNavGroup(
        kind: NavGroupKind,
        title: string,
        count: number,
        rows: React.ReactNode
    ): React.ReactElement | null {
        if (count === 0) return null
        const expanded = this.isNavGroupExpanded(kind)
        const panelId = `gdocs-ref-nav-group-${kind}`
        const header = (
            <>
                <FontAwesomeIcon
                    icon={faChevronRight}
                    className="gdocs-ref__nav-group-chevron"
                />
                <span className="gdocs-ref__nav-group-title">{title}</span>
                <span className="gdocs-ref__nav-group-count">{count}</span>
            </>
        )
        return (
            <div className="gdocs-ref__nav-group" key={kind}>
                {this.query ? (
                    <div className="gdocs-ref__nav-group-header gdocs-ref__nav-group-header--static">
                        {header}
                    </div>
                ) : (
                    <button
                        type="button"
                        className="gdocs-ref__nav-group-header"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={(): void => this.toggleNavGroup(kind)}
                    >
                        {header}
                    </button>
                )}
                {expanded && (
                    <div id={panelId} className="gdocs-ref__nav-group-panel">
                        {rows}
                    </div>
                )}
            </div>
        )
    }

    // The component rows: one sub-group per category, the platform blocks
    // last.
    private renderComponentRows(): React.ReactElement {
        const { componentsByCategory, systemComponents } = this
        return (
            <>
                {componentsByCategory.map(({ category, components }) => (
                    <div className="gdocs-ref__nav-subgroup" key={category}>
                        <div className="gdocs-ref__nav-subgroup-title">
                            {category}
                        </div>
                        <ul>
                            {components.map((component) =>
                                this.renderNavItem("components", component)
                            )}
                        </ul>
                    </div>
                ))}
                {systemComponents.length > 0 && (
                    <div className="gdocs-ref__nav-subgroup">
                        <div className="gdocs-ref__nav-subgroup-title">
                            Platform blocks
                        </div>
                        <ul>
                            {systemComponents.map((component) =>
                                this.renderNavItem("components", component)
                            )}
                        </ul>
                    </div>
                )}
            </>
        )
    }

    private renderNav(): React.ReactElement {
        const {
            filteredTemplates,
            componentsByCategory,
            systemComponents,
            query,
        } = this
        const componentCount =
            componentsByCategory.reduce(
                (sum, { components }) => sum + components.length,
                0
            ) + systemComponents.length
        const nothingMatches =
            query && filteredTemplates.length === 0 && componentCount === 0
        const rowsByKind: Record<
            NavGroupKind,
            { count: number; rows: React.ReactNode }
        > = {
            guides: {
                count: filteredGuides.length,
                rows: (
                    <ul>
                        {filteredGuides.map((guide) =>
                            this.renderNavItem("guides", guide)
                        )}
                    </ul>
                ),
            },
            templates: {
                count: filteredTemplates.length,
                rows: (
                    <ul>
                        {filteredTemplates.map((template) =>
                            this.renderNavItem("templates", template)
                        )}
                    </ul>
                ),
            },
            components: {
                count: componentCount,
                rows: this.renderComponentRows(),
            },
        }
        return (
            <nav className="gdocs-ref__nav" aria-label="Writing reference">
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
                        aria-activedescendant={
                            this.highlightedItem
                                ? this.elementIdFor(
                                      this.highlightedItem.kind,
                                      this.highlightedItem.id
                                  )
                                : undefined
                        }
                    />
                </div>
                <Link
                    className={
                        this.selection
                            ? "gdocs-ref__nav-overview"
                            : "gdocs-ref__nav-overview gdocs-ref__nav-overview--active"
                    }
                    to="/gdocs-reference"
                    aria-current={this.selection ? undefined : "page"}
                >
                    Get started
                </Link>
                {filteredTemplates.length > 0 && (
                    <div className="gdocs-ref__nav-group">
                        <div className="gdocs-ref__nav-group-title">
                            {TEMPLATES_GROUP_TITLE}
                        </div>
                        <ul>
                            {filteredTemplates.map((template) =>
                                this.renderNavItem("templates", template)
                            )}
                        </ul>
                    </div>
                )}
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
    private renderUsageBadge(
        component: ComponentReference
    ): React.ReactElement | null {
        if (!this.usage || component.system) return null
        const usage = this.usageOf(component)
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

    private renderComponentCard(
        component: ComponentReference
    ): React.ReactElement {
        return (
            <Link
                key={component.id}
                className="gdocs-ref__card"
                to={`/gdocs-reference/components/${component.id}`}
            >
                <div className="gdocs-ref__card-title">
                    {component.title}
                    {component.autoGenerated && (
                        <span className="gdocs-ref__badge gdocs-ref__badge--auto-generated">
                            auto-generated
                        </span>
                    )}
                    {this.renderUsageBadge(component)}
                </div>
                <code className="gdocs-ref__card-id">{`{.${component.id}}`}</code>
                <p className="gdocs-ref__card-desc">
                    <InlineMarkdownText
                        text={firstParagraph(component.prose.intro)}
                    />
                </p>
            </Link>
        )
    }

    // How much of our published content a doc type accounts for, in words —
    // the raw count lives in the tooltip.
    private templateContext(
        template: TemplateReference
    ): React.ReactElement | null {
        const totals = this.usage?.totalDocsByType
        if (!totals) return null
        const allDocs = Object.values(totals).reduce(
            (sum, count) => sum + (count ?? 0),
            0
        )
        const count = totals[template.id as OwidGdocType] ?? 0
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
                    template.id as OwidGdocType,
                    count !== 1
                )}`}
            >
                {phrase}
            </span>
        )
    }

    private renderTemplateCard(
        template: TemplateReference
    ): React.ReactElement {
        return (
            <Link
                key={template.id}
                className="gdocs-ref__card gdocs-ref__card--template"
                to={`/gdocs-reference/templates/${template.id}`}
            >
                <div className="gdocs-ref__card-title">
                    {template.title}
                    {this.templateContext(template)}
                </div>
                <code className="gdocs-ref__card-id">{`type: ${template.id}`}</code>
                <p className="gdocs-ref__card-desc">
                    <InlineMarkdownText
                        text={firstParagraph(template.prose.intro)}
                    />
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
                <h1 className="gdocs-ref__page-title">Get started</h1>
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
                            {filteredTemplates.map((template) =>
                                this.renderTemplateCard(template)
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
                {componentsByCategory.map(({ category, components }) => (
                    <section className="gdocs-ref__section" key={category}>
                        <h3 className="gdocs-ref__section-subtitle">
                            {category}
                            <span className="gdocs-ref__section-count">
                                {components.length}
                            </span>
                        </h3>
                        <div className="gdocs-ref__card-grid">
                            {components.map((component) =>
                                this.renderComponentCard(component)
                            )}
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
                            {systemComponents.map((component) =>
                                this.renderComponentCard(component)
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
        previewPathForExample?: (index: number) => string | undefined,
        examples?: ComponentReference["examples"]
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
                            section="whenToUse"
                            examples={examples}
                            previewPathForExample={previewPathForExample}
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
                            section="whenNotToUse"
                            examples={examples}
                            previewPathForExample={previewPathForExample}
                        />
                    </div>
                )}
            </div>
        )
    }

    private renderComponentDetail(
        component: ComponentReference
    ): React.ReactElement {
        const { intro, whenToUse, whenNotToUse, notes } = component.prose
        const previewPath = this.previewPathForComponent(component)
        return (
            <article className="gdocs-ref__detail">
                <header className="gdocs-ref__detail-header">
                    <div className="gdocs-ref__detail-title-row">
                        <h1 className="gdocs-ref__detail-title">
                            {component.title}
                        </h1>
                        <span className="gdocs-ref__category-pill">
                            {component.system
                                ? "Platform block"
                                : component.category}
                        </span>
                    </div>
                </header>
                {component.autoGenerated && (
                    <div className="gdocs-ref__warning">
                        <strong>
                            You don't write this as an ArchieML block.
                        </strong>{" "}
                        It is auto-generated when the document is parsed, from{" "}
                        {component.autoGenerated}.
                    </div>
                )}
                {intro && (
                    <GdocsReferenceMarkdown
                        body={intro}
                        section="intro"
                        examples={component.examples}
                        previewPathForExample={previewPath}
                    />
                )}
                {this.renderDecisionBox(
                    whenToUse,
                    whenNotToUse,
                    previewPath,
                    component.examples
                )}
                {this.usage && !component.system && (
                    <UsageSummary
                        usage={this.usageOf(component)}
                        totalDocsByType={this.usage.totalDocsByType}
                        templateIds={
                            new Set(
                                this.templates.map((template) => template.id)
                            )
                        }
                    />
                )}
                <ComponentForms
                    component={component}
                    usage={this.usageOf(component)}
                    typeLinks={this.propTypeLinks}
                    notes={
                        notes ? (
                            <GdocsReferenceMarkdown
                                body={notes}
                                section="notes"
                                examples={component.examples}
                                previewPathForExample={previewPath}
                            />
                        ) : undefined
                    }
                />
                {component.examples.length === 0 && (
                    <p className="gdocs-ref__note">
                        This component has no standalone ArchieML example — it
                        only appears nested inside other components.
                    </p>
                )}
                <footer className="gdocs-ref__detail-footer">
                    <a
                        href={githubEditUrl(component.sidecarFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faPenToSquare} /> Suggest an edit
                        to this page
                    </a>
                    <a
                        href={githubBlobUrl(component.sourceFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faCode} /> View type definition (
                        {component.typeName})
                    </a>
                </footer>
            </article>
        )
    }

    // The front matter keys, then the sidecar's authored notes beneath them —
    // the same pairing as a component page's properties table: facts derived,
    // reasons authored.
    private renderTemplateFields(
        template: TemplateReference,
        notes: string | undefined
    ): React.ReactElement {
        const authored = template.fields.filter(
            (field) => field.kind === "authored"
        )
        const derived = template.fields.filter(
            (field) => field.kind !== "authored"
        )
        const renderRow = (field: TemplateField): React.ReactElement => (
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
                {notes && (
                    <div className="gdocs-ref__fields-notes">
                        <div className="gdocs-ref__fields-notes-title">
                            Authored notes
                        </div>
                        <GdocsReferenceMarkdown
                            body={notes}
                            section="notes"
                            titleFor={this.titleOf}
                        />
                    </div>
                )}
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
                {template.adminManagedFields.length > 0 && (
                    <p className="gdocs-ref__admin-managed">
                        Managed in the admin, not in the document:{" "}
                        {template.adminManagedFields.map((name, index) => (
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

    private renderTemplateDetail(
        template: TemplateReference
    ): React.ReactElement {
        const { intro, whenToUse, whenNotToUse, notes } = template.prose
        return (
            <article className="gdocs-ref__detail">
                <header className="gdocs-ref__detail-header">
                    <div className="gdocs-ref__detail-title-row">
                        <h1 className="gdocs-ref__detail-title">
                            {template.title}
                        </h1>
                        <span className="gdocs-ref__category-pill">
                            Document template
                        </span>
                    </div>
                </header>
                {intro && (
                    <GdocsReferenceMarkdown body={intro} section="intro" />
                )}
                {this.renderDecisionBox(whenToUse, whenNotToUse)}
                <ExemplarPreview template={template} />
                <SkeletonScaffold template={template} />
                <TemplateComponentShortlist
                    template={template}
                    usage={this.usage}
                    components={this.components}
                />
                {notes && (
                    <GdocsReferenceMarkdown body={notes} section="notes" />
                )}
                {this.renderTemplateFields(template)}
                <footer className="gdocs-ref__detail-footer">
                    <a
                        href={githubEditUrl(template.sidecarFile)}
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
            admin.getJSON<ComponentRegistry>(
                "/api/gdocs-reference/components.json"
            ),
            admin.getJSON<{ templates: TemplateReference[] }>(
                "/api/gdocs-reference/templates.json"
            ),
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

    override componentDidMount(): void {
        void this.getData()
        document.addEventListener("keydown", this.onGlobalKeyDown)
        this.expandNavGroupOfSelection()
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
            this.expandNavGroupOfSelection()
        }
        if (this.highlightedIndex !== this.lastScrolledHighlightIndex) {
            this.lastScrolledHighlightIndex = this.highlightedIndex
            this.scrollHighlightedIntoView()
        }
    }

    // Keeps the highlighted row visible as arrow keys move it past the
    // sidebar's own scroll boundary.
    private scrollHighlightedIntoView(): void {
        const item = this.highlightedItem
        if (!item) return
        document
            .getElementById(this.elementIdFor(item.kind, item.id))
            ?.scrollIntoView({ block: "nearest" })
    }
}
