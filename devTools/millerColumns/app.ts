// Miller-columns reader for the whole site.
//
// Two kinds of columns:
// - Tree columns walk the one canonical hierarchy (topic › article › heading
//   › paragraph). The breadcrumb always matches them.
// - Peek columns float beside the tree. They list a block's links, and for a
//   link its definition (canonical place) and references (every place that
//   points at it). They never extend the tree: following one is a jump.

type Span = string | { t: string; l: number }
type Link = { text: string; target?: string; url?: string; kind: string }
interface TreeNode {
    id: string
    kind: string
    title: string
    parent?: string
    children?: string[]
    alsoIn?: string[]
    spans?: Span[]
    items?: Span[][]
    links?: Link[]
    level?: number
    thumb?: string
    url?: string
    date?: string
    target?: string
    dimension?: string
    sameData?: string[]
    pop?: number
    count?: number // a "N more" row: how many it holds
}
interface Reference {
    from: string
    doc: string
    text: string
    snippet: string
    section?: string
}

// Nodes whose content loads on open. A chart or view's content is its data
// page, so its home reads like a short document.
const DOC_KINDS = new Set([
    "article",
    "data-insight",
    "topic-page",
    "linear-topic-page",
    "chart",
    "view",
])
const BLOCK_KINDS = new Set([
    "paragraph",
    "quote",
    "list",
    "embed",
    "image",
    "prominent-link",
])
// Blocks read in place, with the light selection style.
const READING_KINDS = new Set([
    "paragraph",
    "quote",
    "list",
    "embed",
    "image",
    "title",
])
const KIND_LABEL: Record<string, string> = {
    alias: "Shortcut",
    area: "Area",
    topic: "Topic",
    article: "Article",
    "data-insight": "Data insight",
    "topic-page": "Overview",
    "linear-topic-page": "Overview",
    chart: "Chart",
    mdm: "Data collection",
    explorer: "Explorer",
    dimension: "Views",
    view: "View",
    "narrative-chart": "Chart variant",
    heading: "Section",
    paragraph: "Paragraph",
    embed: "Embedded chart",
    external: "External link",
}
// How a folded group's rows name what it holds: one, many.
const GROUP_NOUN: Record<string, [string, string]> = {
    Articles: ["article", "articles"],
    "Data insights": ["data insight", "data insights"],
    Data: ["chart or collection", "charts and collections"],
    Overview: ["overview", "overviews"],
    Text: ["match in the text", "matches in the text"],
}
const GROUP_OF: Record<string, string> = {
    area: "Topics",
    topic: "Topics",
    "topic-page": "Overview",
    "linear-topic-page": "Overview",
    article: "Articles",
    "data-insight": "Data insights",
    mdm: "Data",
    explorer: "Data",
    chart: "Data",
}

// --- Data ---

const site = (await fetch("/data/site.json").then((r) => r.json())) as {
    nodes: Record<string, TreeNode>
    references: Record<string, Reference[]>
}
const nodes = new Map(Object.entries(site.nodes))
const references = site.references
// Where the side panel leads from a target, after its own home: every place
// that uses it, or, when nothing does, charts of the same data in other
// topics, so the panel never ends in "not used anywhere".
const exitsOf = (id: string): string[] =>
    references[id]?.map((r) => r.from) ?? nodes.get(id)?.sameData ?? []

// The DAG's secondary edges become alias rows in the secondary parent.
for (const n of [...nodes.values()]) {
    for (const parentId of n.alsoIn ?? []) {
        const parent = nodes.get(parentId)
        if (!parent) continue
        const id = `alias:${parentId}>${n.id}`
        nodes.set(id, {
            id,
            kind: "alias",
            title: n.title,
            parent: parentId,
            target: n.id,
        })
        ;(parent.children ??= []).push(id)
    }
}

// A row's group is its kind's; a shortcut sits with the kind of what it
// points to, below the items filed here.
function groupOf(id: string): string | undefined {
    const n = nodes.get(id)!
    return GROUP_OF[n.kind === "alias" ? nodes.get(n.target!)!.kind : n.kind]
}
const isShortcut = (id: string): boolean => nodes.get(id)!.kind === "alias"
const itemNode = (id: string): TreeNode =>
    nodes.get(isShortcut(id) ? nodes.get(id)!.target! : id)!

// Editors' picks: what a place's Overview (its topic page) links to or
// embeds, in the order it appears on the page.
const picks = new Map<string, Map<string, number>>() // place -> item -> order
for (const [target, refs] of Object.entries(references))
    for (const r of refs) {
        const page = nodes.get(r.doc)
        if (!page?.kind.endsWith("topic-page") || !page.parent) continue
        const order = Number(r.from.split("#")[1] ?? 0)
        if (!picks.has(page.parent)) picks.set(page.parent, new Map())
        const placePicks = picks.get(page.parent)!
        const first = placePicks.get(target)
        if (first === undefined || order < first) placePicks.set(target, order)
    }
const pickOrder = (place: string, id: string): number =>
    picks.get(place)?.get(itemNode(id).id) ?? Infinity
// Within a group: items filed here before shortcuts, then the place's
// picks in page order, then the most read.
function inGroupOrder(place: string): (a: string, b: string) => number {
    return (a, b) =>
        Number(isShortcut(a)) - Number(isShortcut(b)) ||
        Math.sign(pickOrder(place, a) - pickOrder(place, b) || 0) ||
        (itemNode(b).pop ?? 0) - (itemNode(a).pop ?? 0)
}

// Every content group shows its first 3, so no kind crowds out another.
// Below them, a "Show 10 more …" row shows the next ones in place, only
// when you press it; the group's label offers "See all", which lists the
// whole group as a search. Leaving the place folds it back to 3.
// Subtopics and the overview never fold: they are the place's structure.
const SHOWN_IN_GROUP = 3
const SHOW_MORE_STEP = 10
// Items past the first 3 of their group: the group's "show more" row, and
// where they sit in the group.
const foldOf = new Map<string, { more: string; at: number }>()
for (const place of [...nodes.values()]) {
    if (place.kind !== "topic" && place.kind !== "area") continue
    const byGroup = new Map<string, string[]>()
    for (const id of place.children ?? []) {
        const group = groupOf(id) ?? ""
        if (!byGroup.has(group)) byGroup.set(group, [])
        byGroup.get(group)!.push(id)
    }
    place.children = []
    for (const [group, ids] of byGroup) {
        ids.sort(inGroupOrder(place.id))
        place.children.push(...ids)
        const rest = ids.length - SHOWN_IN_GROUP
        if (group === "Topics" || group === "Overview" || rest < 2) continue
        const moreId = `more:${place.id}:${group}`
        ids.slice(SHOWN_IN_GROUP).forEach((id, i) =>
            foldOf.set(id, { more: moreId, at: SHOWN_IN_GROUP + i })
        )
        nodes.set(moreId, {
            id: moreId,
            kind: "more",
            title: group,
            parent: place.id,
            count: rest,
        })
        place.children.push(moreId)
    }
}
// How many past the first 3 you asked to see, per "show more" row.
const shownMore = new Map<string, number>()
const extraShown = (moreId: string): number => shownMore.get(moreId) ?? 0
const leftIn = (moreId: string): number =>
    node(moreId).count! - extraShown(moreId)
// The rows a column shows. The selection always shows: a search's look at
// a result may point at one still folded.
const visibleChildren = (id: string, selectedId?: string): string[] =>
    childrenOf(id).filter((k) => {
        const fold = foldOf.get(k)
        if (fold)
            return (
                k === selectedId ||
                fold.at < SHOWN_IN_GROUP + extraShown(fold.more)
            )
        return node(k).kind !== "more" || leftIn(k) > 0
    })
// "Show 10 more data insights", then "Show the last 4 data insights".
function showMoreLabel(left: number, group: string): string {
    const [one, many] = GROUP_NOUN[group] ?? ["item", "items"]
    if (left > SHOW_MORE_STEP) return `Show ${SHOW_MORE_STEP} more ${many}`
    return left === 1 ? `Show the last ${one}` : `Show the last ${left} ${many}`
}
// On a "Show more" row, the other choice and its key: "⌘⏎ See all 14".
// It shows on the selected row and under the mouse, and is clickable.
function seeAllOnRow(total: number, kind: string, place?: string): HTMLElement {
    const b = el(
        "button",
        "row__see-all",
        el("kbd", "", "⌘⏎"),
        `See all ${total}`
    )
    b.dataset.seeAll = kind
    if (place) b.dataset.place = place
    return b
}
// A group's label: its name and size, and "See all" when it folds.
function groupLabel(
    label: string,
    total?: number,
    seeAll?: { kind: string; place?: string }
): HTMLElement {
    const out = el(
        "div",
        "group-label",
        label,
        total === undefined
            ? null
            : el("span", "group-label__count", String(total))
    )
    if (seeAll) {
        const b = el("button", "group-label__all", "See all", icon("chevron"))
        b.dataset.seeAll = seeAll.kind
        if (seeAll.place) b.dataset.place = seeAll.place
        b.title = `List all ${total} ${GROUP_NOUN[label]?.[1] ?? "items"} as a search`
        out.append(b)
    }
    return out
}
// Where a node is filed.
const homeOf = (id: string): TreeNode | undefined =>
    nodes.get(nodes.get(id)?.parent ?? "")

const loadedDocs = new Map<string, Promise<void>>()
// Must match bodyFile() in buildData.mts.
const bodyFile = (id: string): string => id.replace(/[^\w-]/g, "_")
function docOf(id: string): string | undefined {
    if (id.includes("#")) return id.split("#")[0]
    // A document's own title row sits inside it, even before it loads.
    if (id.endsWith("@title")) return docOf(id.slice(0, -"@title".length))
    return DOC_KINDS.has(nodes.get(id)?.kind ?? "") ? id : undefined
}
function loadDoc(docId: string): Promise<void> {
    if (!loadedDocs.has(docId))
        loadedDocs.set(
            docId,
            fetch(`/data/docs/${bodyFile(docId)}.json`)
                .then((r) => (r.ok ? r.json() : {}))
                .then((body: Record<string, TreeNode>) => {
                    for (const [id, n] of Object.entries(body)) nodes.set(id, n)
                    for (const id of [docId, ...Object.keys(body)])
                        if (id === docId || nodes.get(id)!.kind === "heading")
                            addTitleRow(id)
                })
        )
    return loadedDocs.get(docId)!
}

// A document or section column opens with its own title as a selectable
// row, so going up past the first paragraph lands on the title and shows
// where the document is used.
function addTitleRow(parentId: string): void {
    const parent = nodes.get(parentId)!
    const id = `${parentId}@title`
    nodes.set(id, {
        id,
        kind: "title",
        title: parent.title,
        parent: parentId,
        target: parentId,
        level: parent.kind === "heading" ? parent.level : 1,
    })
    parent.children = [id, ...(parent.children ?? [])]
}

const node = (id: string): TreeNode => nodes.get(id)!
const childrenOf = (id: string): string[] => nodes.get(id)?.children ?? []
const hasChildren = (id: string): boolean =>
    DOC_KINDS.has(node(id).kind) || childrenOf(id).length > 0
function ancestry(id: string): string[] {
    const out: string[] = []
    for (let at: string | undefined = id; at; at = nodes.get(at)?.parent)
        out.unshift(at)
    return out
}
const plain = (spans: Span[]): string =>
    spans.map((s) => (typeof s === "string" ? s : s.t)).join("")

// --- State ---

// `path` is the canonical selection: root, then one selected node per column.
// `peek` is the floating side trail for the selected node, when entered.
type PeekFocus = { zone: "links" | "target"; link: number; row: number }
interface Location {
    path: string[]
    peek: PeekFocus | null
    search?: Search // set while the box searches; the tree waits underneath
}
let state: Location = { path: ["root"], peek: null }
let landedOn: string | null = null // briefly highlights a jump's destination

const selected = (): string => state.path[state.path.length - 1]
// Searching, with the arrows on the results rather than inside one.
const onResults = (): boolean =>
    state.search !== undefined && state.search.base === undefined

// History works like VS Code's Go Back: one stop per place you spent time
// in, not one per keypress. A place is the document holding the selection,
// or outside documents the topic list it sits in. Moving within a place updates
// its stop, so going back lands where you left, not where you came in.
// Jumps always add a stop, even within one document.
interface Stop {
    at: Location
    via: "walk" | "jump" // how you got here; the tramline draws jumps dashed
}
const trail: Stop[] = []
let stopIndex = 0
function placeOf(loc: Location): string {
    if (loc.search) return "search" // one stop, however much you type
    const holders = loc.path.slice(0, -1)
    return (
        holders.findLast((id) => DOC_KINDS.has(node(id).kind)) ??
        holders[holders.length - 1] ??
        "root"
    )
}

// What the peek trail shows for a node, if anything.
// - a block with links: the links, then the chosen link's target
// - an embed, alias, prominent link: straight to its one target
// - anything referenced elsewhere (a chart, an article, a view): its own
//   definition and references, like VS Code's "find all references"
type PeekPlan =
    | { kind: "links"; links: Link[] }
    | { kind: "target"; target: Link }
    | null
function peekPlan(id: string): PeekPlan {
    const n = node(id)
    if (n.kind === "title")
        return exitsOf(n.target!).length
            ? {
                  kind: "target",
                  target: {
                      text: n.title,
                      target: n.target,
                      kind: node(n.target!).kind,
                  },
              }
            : null
    if (n.kind === "alias")
        return {
            kind: "target",
            target: {
                text: n.title,
                target: n.target,
                kind: node(n.target!).kind,
            },
        }
    if (n.kind === "embed" || n.kind === "prominent-link")
        return n.links?.[0].target
            ? { kind: "target", target: n.links[0] }
            : null
    if (n.links?.length) return { kind: "links", links: n.links }
    if (exitsOf(id).length && !hasChildren(id))
        return {
            kind: "target",
            target: { text: n.title, target: id, kind: n.kind },
        }
    return null
}
// Nodes with children show them; their references are one key away.
let referencesOpen = false
function activePeek(): PeekPlan {
    const id = selected()
    if (referencesOpen && exitsOf(id).length)
        return {
            kind: "target",
            target: { text: node(id).title, target: id, kind: node(id).kind },
        }
    return peekPlan(id)
}

async function go(
    next: Location,
    opts: { jump?: boolean; fromHistory?: boolean } = {}
): Promise<void> {
    // Inside a result, tree moves keep the search around them, until they
    // climb above the result's own column. Whoever sets `search` decides.
    if (!("search" in next)) {
        const s = state.search
        const inside =
            s?.base !== undefined &&
            next.path.length >= s.base + 2 &&
            next.path[s.base] === state.path[s.base]
        next = { ...next, search: inside ? s : undefined }
    }
    const doc = docOf(next.path[next.path.length - 1])
    if (doc) await loadDoc(doc)
    // Closing a search without opening anything leaves no stop behind.
    const cancelsSearch =
        state.search &&
        !next.search &&
        !opts.jump &&
        !opts.fromHistory &&
        stopIndex > 0 &&
        placeOf(trail[stopIndex - 1].at) === placeOf(next)
    if (cancelsSearch) {
        trail.splice(stopIndex)
        stopIndex--
        trail[stopIndex] = { ...trail[stopIndex], at: next }
    } else if (!opts.fromHistory) {
        if (opts.jump || placeOf(next) !== placeOf(state)) {
            trail.splice(stopIndex + 1)
            trail.push({ at: next, via: opts.jump ? "jump" : "walk" })
            stopIndex = trail.length - 1
        } else trail[stopIndex] = { ...trail[stopIndex], at: next }
    }
    if (next.path.join() !== state.path.join()) referencesOpen = false
    for (const moreId of [...shownMore.keys()])
        if (!next.path.includes(node(moreId).parent!)) shownMore.delete(moreId)
    for (const id of next.path) {
        const fold = foldOf.get(id)
        if (fold && fold.at >= SHOWN_IN_GROUP + extraShown(fold.more))
            shownMore.set(fold.more, fold.at - SHOWN_IN_GROUP + 1)
    }
    const before = state
    state = next
    landedOn = opts.jump || opts.fromHistory ? selected() : null
    render(before)
    history.replaceState(null, "", `#${encodeURIComponent(selected())}`)
}

async function jumpTo(id: string): Promise<void> {
    const doc = docOf(id)
    if (doc) await loadDoc(doc)
    if (!nodes.has(id)) return
    const path = ancestry(id)
    await go({ path, peek: null, search: undefined }, { jump: true })
}

// --- Keyboard ---

function siblingsOf(id: string): string[] {
    const parent = node(id).parent
    return parent ? visibleChildren(parent, id) : [id]
}
async function move(delta: number): Promise<void> {
    const peek = state.peek
    if (peek) {
        const plan = activePeek()!
        const count =
            peek.zone === "links" && plan.kind === "links"
                ? plan.links.length
                : 1 + exitsOf(targetOfPeek(plan, peek)?.target ?? "").length
        const key = peek.zone === "links" ? "link" : "row"
        const value = Math.max(0, Math.min(count - 1, peek[key] + delta))
        await go({
            ...state,
            peek: {
                ...peek,
                [key]: value,
                ...(key === "link" ? { row: 0 } : {}),
            },
        })
        return
    }
    const id = selected()
    const sibs = siblingsOf(id)
    const at = sibs.indexOf(id)
    const nextId = sibs[Math.max(0, Math.min(sibs.length - 1, at + delta))]
    if (nextId !== id)
        await go({ path: [...state.path.slice(0, -1), nextId], peek: null })
}
function targetOfPeek(
    plan: PeekPlan,
    peek: PeekFocus | null
): Link | undefined {
    if (!plan) return undefined
    if (plan.kind === "target") return plan.target
    return plan.links[peek?.link ?? 0]
}
async function right(): Promise<void> {
    const id = selected()
    const plan = activePeek()
    if (state.peek) {
        const link = targetOfPeek(plan, state.peek)
        if (state.peek.zone === "links" && link?.target)
            await go({
                ...state,
                peek: { ...state.peek, zone: "target", row: 0 },
            })
        return
    }
    // On the way down to a search match, → follows the path to it.
    const toMatch = searchTarget()
    if (toMatch && toMatch.length > state.path.length) {
        await go({ path: toMatch.slice(0, state.path.length + 1), peek: null })
        return
    }
    if (node(id).kind === "more") return showMoreRows(state.path)
    if (hasChildren(id) && !referencesOpen) {
        const doc = docOf(id)
        if (doc) await loadDoc(doc)
        const first = childrenOf(id)[0]
        if (first) await go({ path: [...state.path, first], peek: null })
        return
    }
    if (plan)
        await go({
            ...state,
            peek: {
                zone: plan.kind === "links" ? "links" : "target",
                link: 0,
                row: 0,
            },
        })
}
async function left(): Promise<void> {
    const peek = state.peek
    if (peek) {
        const plan = activePeek()
        if (peek.zone === "target" && plan?.kind === "links")
            await go({ ...state, peek: { ...peek, zone: "links" } })
        else await go({ ...state, peek: null })
        return
    }
    if (referencesOpen) {
        referencesOpen = false
        render(state)
        return
    }
    const s = state.search
    if (s?.base !== undefined && state.path.length <= s.base + 2)
        return leaveResult()
    if (state.path.length > 2)
        await go({ path: state.path.slice(0, -1), peek: null })
}
async function enter(): Promise<void> {
    if (node(selected()).kind === "more") return showMoreRows(state.path)
    const plan = activePeek()
    const peek = state.peek ?? {
        zone: plan?.kind === "links" ? "links" : "target",
        link: 0,
        row: 0,
    }
    const link = targetOfPeek(plan, peek)
    const external = node(selected()).links?.[0]
    if (!link && node(selected()).kind === "prominent-link" && external?.url) {
        window.open(external.url, "_blank", "noopener")
        return
    }
    // From the tree, Enter steps in like →: into a document, or into the
    // side panel. Only inside the panel does it jump.
    if (!link || !state.peek) {
        await right()
        return
    }
    if (peek.zone === "links" && plan?.kind === "links" && link.target) {
        await go({ ...state, peek: { ...peek, zone: "target", row: 0 } })
        return
    }
    if (!link.target) {
        window.open(link.url, "_blank", "noopener")
        return
    }
    if (peek.row === 0 && isAtHome(link.target)) return // already here
    if (peek.row === 0) await jumpTo(link.target)
    else await jumpTo(exitsOf(link.target)[peek.row - 1])
}
async function goToStop(i: number): Promise<void> {
    if (i < 0 || i >= trail.length || i === stopIndex) return
    stopIndex = i
    await go(trail[i].at, { fromHistory: true })
}
const back = (): Promise<void> => goToStop(stopIndex - 1)
const forward = (): Promise<void> => goToStop(stopIndex + 1)

document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        return openBox(e.shiftKey ? ">" : undefined)
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        return openFind()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        return seeAllFromRow()
    }
    if (e.metaKey && e.key === "[") return void back()
    if (e.metaKey && e.key === "]") return void forward()
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "/") {
        e.preventDefault()
        return openBox()
    }
    // On the results, the arrows move in them and → steps into one.
    const resultKeys: Record<string, () => Promise<void> | void> = {
        ArrowUp: () => moveResult(-1),
        ArrowDown: () => moveResult(1),
        ArrowRight: enterResult,
        ArrowLeft: closeSearch,
        Enter: openMatch,
        Escape: closeSearch,
        Home: () => moveResult(-1e6),
        End: () => moveResult(1e6),
        Backspace: () => (e.shiftKey ? forward() : back()),
    }
    const treeKeys: Record<string, () => Promise<void> | void> = {
        ArrowUp: () => move(-1),
        ArrowDown: () => move(1),
        ArrowRight: right,
        ArrowLeft: left,
        Enter: enter,
        Backspace: () => (e.shiftKey ? forward() : back()),
        // Inside a result, Esc keeps where you are and drops the search.
        Escape: () =>
            go(
                state.peek || !state.search
                    ? { ...state, peek: null }
                    : { path: state.path, peek: null, search: undefined }
            ),
        Home: () => move(-1e6),
        End: () => move(1e6),
        r: () => {
            if (!exitsOf(selected()).length) return
            referencesOpen = !referencesOpen
            state = { ...state, peek: null }
            render(state)
        },
    }
    const handler = (onResults() ? resultKeys : treeKeys)[e.key]
    if (!handler) return
    e.preventDefault()
    document.body.classList.add("is-keying")
    // Keys typed while a document loads apply in order, after it lands.
    keyQueue = keyQueue.then(handler).catch(console.error)
})
let keyQueue: Promise<void> = Promise.resolve()
// Keys apply one after another, each after the last one has landed.
function queueKey(run: () => Promise<void> | void): void {
    keyQueue = keyQueue.then(run).catch(console.error)
}
document.addEventListener("mousemove", (e) => {
    // Content moving under a still mouse can fire a move with no distance.
    if (e.movementX || e.movementY) document.body.classList.remove("is-keying")
})

// --- Rendering ---

const strip = document.querySelector<HTMLElement>(".strip")!
const crumbs = document.querySelector<HTMLElement>(".crumbs")!
const tramline = document.querySelector<HTMLElement>(".tramline")!
const keys = document.querySelector<HTMLElement>(".keys")!

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag)
    if (className) e.className = className
    for (const c of children) if (c) e.append(c)
    return e
}
function icon(name: string): SVGSVGElement {
    const paths: Record<string, string> = {
        chevron: "m6 3 5 5-5 5",
        "show-more": "m3 6 5 5 5-5",
        jump: "M5 11 11 5M6 5h5v5",
        link: "M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L8 4.5M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l1-1",
        external: "M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5",
        refs: "M3 4h10M3 8h10M3 12h6",
        here: "M8 2v3M8 11v3M2 8h3M11 8h3M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
        search: "M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9ZM10.3 10.3 13.5 13.5",
        copy: "M5.5 5.5h7v7h-7zM10.5 5.5v-2h-7v7h2",
        up: "M8 13V3M4 7l4-4 4 4",
        back: "M10 3 5 8l5 5",
        forward: "m6 3 5 5-5 5",
        section: "M3 4h10M3 8h7M3 12h4",
        paragraph: "M3 4h10M3 7h10M3 10h10M3 13h6",
        command: "m4 4 4 4-4 4M9 12h4",
        place: "M3 3h10v10H3zM3 7h10",
        topic: "M2 4h4.5L8 5.5h6V13H2z",
        "topic-page": "M2.5 3h11v10h-11zM2.5 6.5h11M6 6.5V13",
        article: "M4 2h5.5L12 4.5V14H4zM6.5 7.5h3M6.5 10h3",
        "data-insight":
            "M6.5 12h3M7 14h2M8 2a4 4 0 0 0-2.3 7.3c.5.4.8.9.8 1.5V11h3v-.2c0-.6.3-1.1.8-1.5A4 4 0 0 0 8 2Z",
        chart: "M2.5 13.5h11M4.5 11V8M8 11V4M11.5 11V6.5",
        mdm: "M8 2.5 13.5 5 8 7.5 2.5 5zM2.5 8 8 10.5 13.5 8M2.5 11 8 13.5 13.5 11",
        explorer:
            "M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2ZM10.5 5.5 9.2 9.2 5.5 10.5 6.8 6.8z",
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", "0 0 16 16")
    svg.setAttribute("aria-hidden", "true")
    svg.classList.add("icon", `icon--${name}`)
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", paths[name])
    svg.append(path)
    return svg
}
// What a row is, at a glance: one icon per kind, so the meta line no
// longer has to spell it out. Rows with a chart picture don't need one.
const KIND_ICON: Record<string, string> = {
    area: "topic",
    topic: "topic",
    "topic-page": "topic-page",
    "linear-topic-page": "topic-page",
    article: "article",
    "data-insight": "data-insight",
    chart: "chart",
    view: "chart",
    "narrative-chart": "chart",
    mdm: "mdm",
    explorer: "explorer",
    dimension: "mdm",
}
function kindIcon(kind: string): SVGSVGElement | null {
    const name = KIND_ICON[kind]
    if (!name) return null
    const svg = icon(name)
    svg.classList.add("kind-icon")
    return svg
}
// Each render rebuilds the DOM; reusing the same <img> keeps the decoded
// picture on screen instead of flashing while it reloads.
const imageCache = new Map<string, HTMLImageElement>()
const imagesUsedThisRender = new Set<HTMLImageElement>()
function thumb(url: string, className: string, width = 640): HTMLImageElement {
    const key = `${className} ${url}`
    const cached = imageCache.get(key)
    if (cached && !imagesUsedThisRender.has(cached)) {
        imagesUsedThisRender.add(cached)
        return cached
    }
    const img = el("img", className)
    imageCache.set(key, img)
    imagesUsedThisRender.add(img)
    img.loading = "lazy"
    img.decoding = "async"
    img.alt = ""
    img.src = url.includes("imagedelivery")
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}imWidth=${width}`
    img.addEventListener("error", () => img.classList.add("is-broken"))
    return img
}
function renderSpans(spans: Span[], activeLink?: number): DocumentFragment {
    const f = document.createDocumentFragment()
    for (const s of spans) {
        if (typeof s === "string") f.append(s)
        else {
            const a = el("span", "inline-link", s.t)
            a.dataset.link = String(s.l)
            if (s.l === activeLink) a.classList.add("is-active")
            f.append(a)
        }
    }
    return f
}
function metaLine(n: TreeNode): string {
    const parts: string[] = []
    if (n.date) parts.push(n.date.slice(0, 4))
    if (n.kind === "mdm" || n.kind === "dimension")
        parts.push(`${countLeaves(n.id)} views`)
    if (n.kind === "area" || n.kind === "topic")
        parts.push(
            `${childrenOf(n.id).filter((k) => node(k).kind !== "more").length} items`
        )
    return parts.join(" · ")
}
function countLeaves(id: string): number {
    const kids = childrenOf(id)
    return kids.length ? kids.reduce((sum, k) => sum + countLeaves(k), 0) : 1
}

function renderRow(
    id: string,
    isSelected: boolean,
    isTrail: boolean,
    activeLink?: number
): HTMLElement {
    const n = node(id)
    const row = el("div", `row row--${n.kind}`)
    row.dataset.id = id
    row.setAttribute("role", "option")
    row.setAttribute("aria-selected", String(isSelected))
    if (isSelected) row.classList.add(isTrail ? "is-trail" : "is-selected")
    if (landedOn === id) row.classList.add("is-landed")
    // Blue is the side panel's colour: a block wears it only when selecting
    // it opens something on the side.
    if (READING_KINDS.has(n.kind) && peekPlan(id))
        row.classList.add("has-context")
    const refCount = references[id]?.length
    const trailing = el("span", "row__trailing")
    if (refCount && n.kind !== "embed") {
        const pill = el("button", "refs-pill", icon("refs"), String(refCount))
        pill.title = `${refCount} references (R)`
        pill.dataset.refs = id
        trailing.append(pill)
    }
    switch (n.kind) {
        case "paragraph":
        case "quote":
            row.append(
                el(
                    "p",
                    "prose",
                    renderSpans(n.spans!, isSelected ? activeLink : undefined)
                )
            )
            if (n.links)
                trailing.append(
                    el(
                        "span",
                        "link-count",
                        icon("link"),
                        String(n.links.length)
                    )
                )
            break
        case "list": {
            const ul = el("ul", "prose prose--list")
            for (const item of n.items!)
                ul.append(el("li", "", renderSpans(item)))
            row.append(ul)
            if (n.links)
                trailing.append(
                    el(
                        "span",
                        "link-count",
                        icon("link"),
                        String(n.links.length)
                    )
                )
            break
        }
        case "embed":
        case "image": {
            // At the chart's own home, selecting it shows where it's used.
            const atHome = n.target !== undefined && n.target === docOf(id)
            const uses = references[n.target ?? ""]?.length ?? 0
            const caption = atHome
                ? [
                      icon("refs"),
                      uses
                          ? `Used in ${uses} place${uses === 1 ? "" : "s"}`
                          : "Not used anywhere",
                  ]
                : [n.kind === "embed" ? icon("jump") : null, n.title]
            const frame = el(
                "div",
                "figure__frame",
                n.thumb ? thumb(n.thumb, "figure__img") : null
            )
            if (n.kind === "embed" && n.url) {
                frame.dataset.live = n.url
                frame.dataset.liveKey = id
            }
            row.append(
                el(
                    "figure",
                    "figure",
                    frame,
                    el("figcaption", "figure__caption", ...caption)
                )
            )
            break
        }
        case "title": {
            const isSection = node(n.target!).kind === "heading"
            row.append(
                el(
                    "h2",
                    `col__title ${isSection ? "col__title--section" : ""}`,
                    n.title
                )
            )
            // A section stuck at the top of its column also names the
            // document it is in, and the sections above it.
            if (isSection) {
                const doc = docOf(n.target!)!
                const above = ancestry(n.target!)
                    .slice(ancestry(n.target!).indexOf(doc), -1)
                    .map((k) => node(k).title)
                row.append(el("p", "col__context", `In ${above.join(" › ")}`))
            }
            break
        }
        case "heading":
            row.append(
                el("span", `heading heading--h${n.level}`, n.title),
                icon("chevron")
            )
            break
        case "alias": {
            const home = homeOf(n.target!)!
            row.append(
                kindIcon(node(n.target!).kind) ?? "",
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", n.title),
                    el(
                        "span",
                        "row__meta",
                        icon("jump"),
                        `Lives in ${home.title}`
                    )
                )
            )
            break
        }
        case "more": {
            row.append(
                icon("show-more"),
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", showMoreLabel(leftIn(id), n.title))
                ),
                seeAllOnRow(
                    SHOWN_IN_GROUP + n.count!,
                    SECTION_KEYWORD[n.title],
                    n.parent
                )
            )
            break
        }
        case "prominent-link":
            row.append(
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", n.title),
                    el("span", "row__meta", icon("jump"), "Further reading")
                )
            )
            break
        default: {
            const withThumb =
                (n.kind === "chart" ||
                    n.kind === "view" ||
                    n.kind === "narrative-chart") &&
                n.thumb
            if (withThumb) row.append(thumb(n.thumb!, "row__thumb", 240))
            // Areas are the root list: their serif title says enough.
            else if (n.kind !== "area") row.append(kindIcon(n.kind) ?? "")
            const meta = metaLine(n)
            row.append(
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", n.title),
                    meta ? el("span", "row__meta", meta) : null
                )
            )
            if (hasChildren(id)) trailing.append(icon("chevron"))
        }
    }
    if (trailing.childNodes.length) row.append(trailing)
    return row
}

function isProseColumn(parentId: string): boolean {
    const kids = childrenOf(parentId)
    return kids.some((k) => BLOCK_KINDS.has(node(k).kind))
}

function treeColumn(
    parentId: string,
    selectedId: string | undefined,
    depth: number,
    isTrail: boolean
): HTMLElement {
    const parent = node(parentId)
    const prose = isProseColumn(parentId)
    const col = el("section", `col ${prose ? "col--prose" : "col--list"}`)
    col.dataset.parent = parentId
    col.dataset.depth = String(depth)
    col.setAttribute("role", "listbox")
    col.setAttribute("aria-label", parent.title)
    const list = el("div", "col__body")
    let group = ""
    const peekLink =
        state.peek?.link ?? (activePeek()?.kind === "links" ? -1 : undefined)
    for (const id of visibleChildren(parentId, selectedId)) {
        // A "N more" row sits under its group's header.
        const g =
            node(id).dimension ??
            (node(id).kind === "more" ? node(id).title : groupOf(id))
        if (!prose && g && g !== group) {
            const more = nodes.get(`more:${parentId}:${g}`)
            list.append(
                more
                    ? groupLabel(g, SHOWN_IN_GROUP + more.count!, {
                          kind: SECTION_KEYWORD[g],
                          place: parentId,
                      })
                    : groupLabel(g)
            )
            group = g
        }
        list.append(renderRow(id, id === selectedId, isTrail, peekLink))
    }
    if (!childrenOf(parentId).length) {
        const empty = loadedDocs.has(parentId) || !DOC_KINDS.has(parent.kind)
        list.append(el("p", "col__empty", empty ? "Nothing here." : "Loading…"))
    }
    col.append(list)
    return col
}

// The peek trail: "Links in this paragraph", then the link's target.
function peekColumns(): HTMLElement[] {
    const plan = activePeek()
    if (!plan) return []
    const peek = state.peek
    const out: HTMLElement[] = []
    if (plan.kind === "links") {
        const col = el("section", "col col--peek col--links")
        col.dataset.peekKey = `links ${selected()}`
        col.append(
            el(
                "header",
                "peek__header",
                icon("link"),
                `Links in this ${KIND_LABEL[node(selected()).kind]?.toLowerCase() ?? "block"}`
            )
        )
        const body = el("div", "col__body")
        plan.links.forEach((l, i) => {
            // An external link is the end of the trail: the row is the link.
            const row = l.target
                ? el("div", "row row--link")
                : Object.assign(el("a", "row row--link row--external"), {
                      href: l.url ?? "",
                      target: "_blank",
                      rel: "noopener",
                  })
            row.dataset.peekLink = String(i)
            const isSel = peek ? peek.link === i : false
            if (isSel)
                row.classList.add(
                    peek!.zone === "links" ? "is-selected" : "is-trail"
                )
            if (!l.target) {
                const url = new URL(l.url ?? "", "https://ourworldindata.org")
                row.append(
                    el(
                        "span",
                        "row__text",
                        el(
                            "span",
                            "row__title",
                            url.hostname.replace(/^www\./, "")
                        ),
                        el(
                            "span",
                            "row__meta row__meta--url",
                            el("span", "url__host", "External site"),
                            el(
                                "span",
                                "url__path",
                                url.pathname === "/" ? "" : ` · ${url.pathname}`
                            )
                        ),
                        isSel && peek!.zone === "links"
                            ? el(
                                  "span",
                                  "row__hint",
                                  el("kbd", "", "⏎"),
                                  "Opens in a new tab"
                              )
                            : null
                    ),
                    icon("external")
                )
                body.append(row)
                return
            }
            const target = node(l.target)
            const home = homeOf(target.id)
            row.append(
                kindIcon(target.kind) ?? "",
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", target.title),
                    el(
                        "span",
                        "row__meta",
                        `${KIND_LABEL[target.kind] ?? target.kind}${home ? ` in ${home.title}` : ""}`
                    )
                )
            )
            body.append(row)
        })
        col.append(body)
        out.push(col)
    }
    const link = targetOfPeek(plan, peek)
    const showTarget = plan.kind === "target" || peek !== null
    if (link?.target && showTarget)
        out.push(
            targetColumn(
                link as Link & { target: string },
                peek?.zone === "target" ? peek.row : -1
            )
        )
    return out
}

// On the target itself or inside its own page. An embed in an article is
// "this" chart too, but you are reading it in the article, not at its home.
const isAtHome = (target: string): boolean =>
    target === selected() || docOf(selected()) === target

const kindName = (kind: string): string =>
    (KIND_LABEL[kind] ?? kind).toLowerCase()

// What a topic holds, counted by kind: "2 subtopics · 3 articles · 12 charts".
const CONTENT_NOUNS: [string, string, string][] = [
    ["topic", "subtopic", "subtopics"],
    ["article", "article", "articles"],
    ["data-insight", "data insight", "data insights"],
    ["chart", "chart", "charts"],
    ["mdm", "data collection", "data collections"],
    ["explorer", "explorer", "explorers"],
]
function contentsOf(id: string): string {
    // A document's blocks may not be loaded yet; they aren't counted anyway.
    const kinds = childrenOf(id).map((k) => nodes.get(k)?.kind)
    return CONTENT_NOUNS.map(([kind, one, many]) => {
        const count = kinds.filter((k) => k === kind).length
        return count ? `${count} ${count === 1 ? one : many}` : ""
    })
        .filter(Boolean)
        .join(" · ")
}

function targetColumn(
    link: Link & { target: string },
    row: number
): HTMLElement {
    const col = el("section", "col col--peek col--target")
    col.dataset.peekKey = `target ${link.target}`
    const target = node(link.target)
    const isSelf =
        link.target === selected() || link.target === node(selected()).target
    const isHome = isAtHome(link.target)
    const isShortcut = node(selected()).kind === "alias"
    col.append(
        el(
            "header",
            "peek__header",
            isShortcut
                ? `Shortcut to a ${kindName(target.kind)}`
                : `${isSelf ? "This" : "Linked"} ${kindName(target.kind)}`
        )
    )
    const body = el("div", "col__body")

    // Definition: what the target is, where it lives, what it holds.
    const def = el(
        "div",
        `row row--definition ${row === 0 ? "is-selected" : ""}`
    )
    def.dataset.peekRow = "0"
    if (target.thumb) def.append(thumb(target.thumb, "def__thumb"))
    def.append(
        el(
            "div",
            "def__title",
            kindIcon(target.kind),
            el("span", "", target.title)
        )
    )
    const home = ancestry(link.target)
        .slice(1, -1)
        .map((id) => node(id).title)
    if (home.length)
        def.append(el("div", "def__home", `In ${home.join(" › ")}`))
    const holds = contentsOf(link.target)
    if (holds) def.append(el("div", "def__holds", holds))
    def.append(el("div", "def__action", isHome ? "You are here" : "⏎ Go there"))
    body.append(def)

    // References: every block that links to or embeds the target.
    const refs = references[link.target] ?? []
    // Nothing uses it: offer its few closest relatives instead, each named
    // by the topic it lives in, since that is where the jump lands.
    const sameData = refs.length ? [] : (target.sameData ?? [])
    if (refs.length || sameData.length)
        body.append(
            el(
                "div",
                "group-label",
                refs.length
                    ? `Used in ${refs.length} place${refs.length === 1 ? "" : "s"}`
                    : "Same data in other topics"
            )
        )
    sameData.forEach((id, i) => {
        const rr = el(
            "div",
            `row row--link ${row === i + 1 ? "is-selected" : ""}`
        )
        rr.dataset.peekRow = String(i + 1)
        rr.append(
            el(
                "span",
                "row__text",
                el("span", "row__title", node(id).title),
                el("span", "row__meta", icon("jump"), `in ${homeOf(id)!.title}`)
            )
        )
        body.append(rr)
    })
    // One card per document: its title, then each place it uses the target,
    // so a selected place reads as part of its document.
    let group: HTMLElement | undefined
    refs.forEach((r, i) => {
        if (r.doc !== refs[i - 1]?.doc) {
            const doc = nodes.get(r.doc)
            group = el(
                "div",
                "ref-group",
                el(
                    "div",
                    "ref-doc",
                    doc ? doc.title : r.doc,
                    doc
                        ? el("span", "ref-doc__home", homeOf(doc.id)!.title)
                        : null
                )
            )
            body.append(group)
        }
        const isSelected = row === i + 1
        if (isSelected) group!.classList.add("has-selection")
        const rr = el("div", `row row--ref ${isSelected ? "is-selected" : ""}`)
        rr.dataset.peekRow = String(i + 1)
        if (r.from === selected())
            rr.append(el("span", "ref__origin", "You are here"))
        const snip = el("p", "ref__snippet")
        if (r.text === "embedded")
            snip.append(
                el(
                    "em",
                    "",
                    r.section
                        ? `Embedded under “${r.section}”`
                        : "Embedded as a chart"
                )
            )
        else if (!r.snippet)
            // Further-reading boxes carry a title, not a sentence.
            snip.append(el("em", "", "Further reading box"))
        else {
            const at = r.snippet.indexOf(r.text)
            if (at >= 0)
                snip.append(
                    r.snippet.slice(0, at),
                    el("mark", "", r.text),
                    r.snippet.slice(at + r.text.length)
                )
            else snip.append(r.snippet)
        }
        rr.append(snip)
        group!.append(rr)
    })
    col.append(body)
    return col
}

function renderCrumbs(): void {
    crumbs.replaceChildren()
    const ol = el("ol", "crumbs__list")
    // The title row is the document itself: the crumbs already name it.
    if (state.search && onResults()) {
        const s = state.search
        for (const id of ancestry(s.scope)) {
            const li = el("li", "", id === "root" ? "Search" : node(id).title)
            li.dataset.scope = id
            ol.append(li)
        }
        ol.append(el("li", "crumbs__here", s.query.trim() || searchTitle(s)))
    }
    const shown = onResults()
        ? []
        : state.path.slice(1).filter((id) => node(id).kind !== "title")
    shown.forEach((id, i, all) => {
        const n = node(id)
        const label =
            n.kind === "paragraph" || n.kind === "list" || n.kind === "quote"
                ? `¶ ${plain(n.spans ?? n.items?.[0] ?? []).slice(0, 48)}…`
                : n.title
        const li = el("li", i === all.length - 1 ? "crumbs__here" : "", label)
        li.dataset.crumb = String(state.path.indexOf(id))
        ol.append(li)
    })
    crumbs.append(ol)
    const also = onResults() ? undefined : node(selected()).alsoIn
    if (also?.length)
        crumbs.append(
            el(
                "span",
                "crumbs__also",
                "Also listed in ",
                also.map((a) => node(a).title).join(", ")
            )
        )
    renderTramline()
    document.querySelector<HTMLButtonElement>(
        '[data-action="back"]'
    )!.disabled = stopIndex === 0
    document.querySelector<HTMLButtonElement>(
        '[data-action="forward"]'
    )!.disabled = stopIndex === trail.length - 1
}

const stopTitle = (stop: Stop): string =>
    stop.at.search ? searchTitle(stop.at.search) : node(placeOf(stop.at)).title
function searchTitle(s: Search): string {
    const words = s.query.trim()
    const what = words
        ? `“${words}”`
        : DOC_KINDS.has(node(s.scope).kind)
          ? "Sections"
          : s.sort === "best" && !s.kinds.length
            ? "Everything"
            : [
                  SORTS[s.sort],
                  ...s.kinds.map((k) => KEYWORD_KINDS[k].label),
              ].join(" ")
    return `${what} in ${s.scope === "root" ? "the site" : node(s.scope).title}`
}

// The places visited, as a tram line: a stop per place, dashed where you
// jumped, solid where you walked. Only the stops either side of you are
// named; the rest are dots, named on hover.
const TRAM_REACH = 4 // stops shown on each side of the current one
function renderTramline(): void {
    tramline.hidden = trail.length < 2
    const from = Math.max(0, stopIndex - TRAM_REACH)
    const to = Math.min(trail.length, stopIndex + TRAM_REACH + 1)
    const ol = el("ol", "tram")
    if (from > 0) ol.append(el("li", "tram__more", `+${from}`))
    for (let i = from; i < to; i++) {
        const stop = trail[i]
        const where =
            i < stopIndex ? "is-past" : i > stopIndex ? "is-ahead" : "is-here"
        const li = el("li", `tram__stop ${where}`)
        if (stop.via === "jump" && i > from) li.classList.add("is-jump")
        const named = Math.abs(i - stopIndex) <= 1
        const button = el(
            "button",
            "tram__button",
            el("span", "tram__dot"),
            named ? el("span", "tram__label", stopTitle(stop)) : null
        )
        button.dataset.stop = String(i)
        const hint =
            i === stopIndex - 1 ? " (⌫)" : i === stopIndex + 1 ? " (⇧⌫)" : ""
        button.title =
            i === stopIndex
                ? `You are here: ${stopTitle(stop)}`
                : `${stopTitle(stop)}${hint}`
        if (i === stopIndex) button.setAttribute("aria-current", "location")
        li.append(button)
        ol.append(li)
    }
    if (to < trail.length)
        ol.append(el("li", "tram__more", `+${trail.length - to}`))
    tramline.replaceChildren(ol)
}

function renderKeys(): void {
    if (onResults()) {
        const hints: [string, string][] = [
            ["↑ ↓", "Move in the results"],
            ...enterHints(state.search!).map(([k, label]): [string, string] => [
                k,
                label.replace(/^./, (c) => c.toUpperCase()),
            ]),
            ["⌫", "In the box, at the start: widen"],
            ["← esc", "Back where you were"],
            ["/", "Edit the search"],
        ]
        keys.replaceChildren(
            ...hints.map(([k, label]) =>
                el("span", "keys__hint", el("kbd", "", k), label)
            )
        )
        return
    }
    const plan = activePeek()
    const hints: [string, string][] = [
        ["↑ ↓", state.peek ? "Move in the side panel" : "Previous / next"],
    ]
    if (state.peek) {
        hints.push(["←", "Back to the tree"])
        const external = !targetOfPeek(plan, state.peek)?.target
        hints.push(["⏎", external ? "Open in a new tab" : "Jump there"])
    } else {
        if (node(selected()).kind === "more") {
            hints.push(["→ ⏎", "Show them here"])
            hints.push(["⌘⏎", "See all, as a search"])
        } else if (hasChildren(selected()) && !referencesOpen)
            hints.push(["→ ⏎", "Open"])
        else if (plan)
            hints.push([
                "→ ⏎",
                plan.kind === "links"
                    ? "Look at its links"
                    : "Look at its references",
            ])
        const s = state.search
        if (s?.base !== undefined && state.path.length <= s.base + 2)
            hints.push(["←", "Back to the results"])
        else if (state.path.length > 2) hints.push(["←", "Up a level"])
        if (exitsOf(selected()).length && hasChildren(selected()))
            hints.push([
                "R",
                references[selected()]
                    ? referencesOpen
                        ? "Hide references"
                        : "References"
                    : referencesOpen
                      ? "Hide same data"
                      : "Same data elsewhere",
            ])
    }
    if (state.search && !state.peek)
        hints.push(["esc", "Stay here, close the search"])
    if (stopIndex > 0) hints.push(["⌫", "Back"])
    hints.push(["/", "Search"])
    if (docOf(selected())) hints.push(["⌘F", "Find in this page"])
    hints.push(["⌘⇧K", "Commands"])
    keys.replaceChildren(
        ...hints.map(([k, label]) =>
            el("span", "keys__hint", el("kbd", "", k), label)
        )
    )
}

// Ancestors far from the selection fold into spines so the reading columns
// keep their width; the spine still names the selected item at that level.
// --- Live charts ---

// Charts render live from the local site as they come near the view, one
// column-height ahead. The picture stays underneath until the chart loads.
declare const __LOCAL_SITE__: string
const localUrl = (url: string): string =>
    url.replace("https://ourworldindata.org", __LOCAL_SITE__)

// Columns are rebuilt on every render. A chart already on screen moves into
// the new figure with moveBefore(), which keeps it running; a plain move
// would reload it.
const liveCharts = new Map<string, HTMLIFrameElement>() // row id -> chart
function adoptLiveCharts(columns: HTMLElement[]): void {
    const kept = new Set<string>()
    const frames = columns.flatMap((c) => [
        ...c.querySelectorAll<HTMLElement>("[data-live-key]"),
    ])
    for (const frame of frames) {
        const key = frame.dataset.liveKey!
        const chart = liveCharts.get(key)
        if (!chart || kept.has(key)) continue
        frame.moveBefore(chart, null)
        kept.add(key)
    }
    for (const key of liveCharts.keys())
        if (!kept.has(key)) liveCharts.delete(key)
}
let nearObservers: IntersectionObserver[] = []
function watchForNearCharts(): void {
    nearObservers.forEach((o) => o.disconnect())
    nearObservers = [...strip.querySelectorAll<HTMLElement>(".col__body")].map(
        (body) => {
            const observer = new IntersectionObserver(
                (entries) => {
                    for (const e of entries) {
                        if (!e.isIntersecting) continue
                        observer.unobserve(e.target)
                        loadLiveChart(e.target as HTMLElement)
                    }
                },
                { root: body, rootMargin: "100% 0px" }
            )
            body.querySelectorAll("[data-live-key]").forEach((f) =>
                observer.observe(f)
            )
            return observer
        }
    )
}
function loadLiveChart(frame: HTMLElement): void {
    const key = frame.dataset.liveKey!
    if (liveCharts.has(key)) return
    const chart = el("iframe", "live-chart")
    chart.title = "Interactive chart"
    chart.src = localUrl(frame.dataset.live!)
    chart.addEventListener("load", () => chart.classList.add("is-loaded"))
    frame.append(chart)
    liveCharts.set(key, chart)
}

// Each column keeps its chosen row in view, so the whole trail is visible.
// Like Finder, it scrolls only as far as needed, and not at all when the row
// is already in view.
function keepTrailInView(): void {
    for (const row of strip.querySelectorAll<HTMLElement>(
        ".is-trail, .is-selected"
    )) {
        const body = row.closest<HTMLElement>(".col__body")
        if (!body) continue
        const top = row.offsetTop - body.offsetTop
        const bottom = top + row.offsetHeight
        const margin = 12
        if (top < body.scrollTop) body.scrollTop = top - margin
        else if (bottom > body.scrollTop + body.clientHeight)
            body.scrollTop = bottom - body.clientHeight + margin
    }
}
function layout(): void {
    const cols = [...strip.querySelectorAll<HTMLElement>(":scope > .col")]
    cols.forEach((c) => c.classList.remove("is-folded", "is-hidden"))
    const trailing = strip.querySelector<HTMLElement>(":scope > .trailing")!
    const available = strip.clientWidth
    const treeWidth = (): number =>
        cols.reduce((s, c) => s + c.getBoundingClientRect().width, 0)
    const fits = (): boolean => treeWidth() + TRAILING_WIDTH <= available
    // Everything left of the selection's own column may fold, until the
    // tree and the side slot fit.
    const focus = strip.querySelector<HTMLElement>(":scope > .col.is-focus")
    const ancestors = cols.slice(0, focus ? cols.indexOf(focus) : -1)
    for (const c of ancestors) {
        if (fits()) break
        c.classList.add("is-folded")
    }
    // Still too wide: keep only the nearest folded level. The breadcrumb
    // above names the rest.
    // The results never hide: their folded strip is how you know you are
    // still inside a search, and the way back to it.
    if (!fits())
        ancestors
            .slice(0, -1)
            .filter((c) => !c.classList.contains("col--results"))
            .forEach((c) => c.classList.add("is-hidden"))
    keepTrailInView()
    // Columns never shrink: when they don't all fit, the view follows the
    // focus. Reading keeps the column whole; stepping into the side panel
    // slides it fully into view.
    const origin = strip.getBoundingClientRect().left - strip.scrollLeft
    const rightOf = (e: Element): number =>
        e.getBoundingClientRect().right - origin
    const dock = trailing.querySelector<HTMLElement>(".peek-dock")
    const focusRight =
        state.peek && dock
            ? rightOf(dock) + 12
            : cols.length
              ? rightOf(cols[cols.length - 1])
              : 0
    // Never past the left edge of what stays shown left of the focus.
    const leftOf = (e: Element): number =>
        e.getBoundingClientRect().left - origin
    strip.scrollLeft = Math.max(
        0,
        Math.min(
            focusRight - available,
            // The folded strips left of the focus stay in view with it.
            focus
                ? leftOf(cols.find((c) => !c.classList.contains("is-hidden"))!)
                : Infinity
        )
    )
}
const TRAILING_WIDTH = 760

const columnScroll = new Map<string, number>() // column parent -> scrollTop
function render(before: Location): void {
    const keep = new Set<string>()
    const prefix = before.path.findIndex((id, i) => state.path[i] !== id)
    const common =
        prefix === -1 ? Math.min(before.path.length, state.path.length) : prefix
    imagesUsedThisRender.clear()
    const hadDock = strip.querySelector(".peek-dock") !== null
    const peekScroll = new Map<string, number>()
    strip
        .querySelectorAll<HTMLElement>(".col[data-peek-key]")
        .forEach((c) =>
            peekScroll.set(
                c.dataset.peekKey!,
                c.querySelector(".col__body")!.scrollTop
            )
        )
    // A folded column hides its body and reads 0, so only visible columns
    // update where each column was scrolled.
    strip
        .querySelectorAll<HTMLElement>(
            ".col[data-parent]:not(.is-folded, .is-hidden)"
        )
        .forEach((c) =>
            columnScroll.set(
                c.dataset.parent!,
                c.querySelector(".col__body")!.scrollTop
            )
        )

    // The results list keeps its scroll while you move in it.
    const results = strip.querySelector<HTMLElement>(".col--results")
    const resultsScroll = results && {
        key: results.dataset.resultsKey,
        top: results.querySelector(".col__body")!.scrollTop,
    }

    const cols: HTMLElement[] = []
    // Whatever sits right of the selection (a preview, the side panel, or
    // nothing) goes in one fixed-width slot, so it never moves the columns.
    const trailing = el("div", "trailing")
    // The tree from `start` on: one column per selected level, then what
    // the selection holds. While searching, it starts at the result's own
    // column; before you step in, it is only a look at the result.
    // Columns from `lookFrom` on are only a look: they show the way down
    // to a search match, past the selection.
    const treeFrom = (p: string[], start: number, lookFrom: number): void => {
        const depth = Number.isFinite(lookFrom) ? lookFrom + 1 : p.length
        for (let i = start; i < p.length; i++) {
            const parentId = p[i]
            const selectedId = p[i + 1]
            if (!selectedId && !hasChildren(parentId)) break
            if (!selectedId && referencesOpen) break
            const look = i >= lookFrom
            const isTrail = look || i < depth - 2 || state.peek !== null
            const col = treeColumn(parentId, selectedId, i, isTrail)
            if (look) col.dataset.search = "look"
            // With the way to a match shown past it, the view follows the
            // selection's own column, not the far end.
            if (Number.isFinite(lookFrom) && i === depth - 2 && !look)
                col.classList.add("is-focus")
            if (!selectedId) col.classList.add("col--preview")
            if (i >= common && landedOn) col.classList.add("is-arriving")
            else keep.add(parentId)
            const spine = el(
                "button",
                "spine",
                el(
                    "span",
                    "spine__label",
                    selectedId
                        ? node(selectedId).title || "¶"
                        : node(parentId).title
                )
            )
            spine.dataset.crumb = String(i + 1)
            col.prepend(spine)
            if (selectedId) cols.push(col)
            else trailing.append(col)
        }
    }
    const s = state.search
    if (s) {
        cols.push(...searchColumns(s))
        const r = highlighted(s)
        // Stepped in: the selection, then the rest of the way to the match.
        const toMatch = searchTarget()
        if (s.base !== undefined)
            treeFrom(
                toMatch ?? state.path,
                s.base,
                toMatch ? state.path.length - 1 : Infinity
            )
        else if (r && nodes.has(r.id)) {
            treeFrom(ancestry(r.id), resultBase(r.id, s), resultBase(r.id, s))
        }
    } else treeFrom(state.path, 0, Infinity)
    if (!s || s.base !== undefined) {
        const peekCols = peekColumns()
        if (peekCols.length) {
            const dock = el("div", "peek-dock", ...peekCols)
            if (state.peek) dock.classList.add("is-active")
            if (!hadDock) dock.classList.add("is-entering")
            trailing.append(dock)
        }
    }
    // The old columns leave only after live charts have moved out of them.
    const oldColumns = [...strip.children]
    strip.append(...cols, trailing)
    adoptLiveCharts([...cols, trailing])
    oldColumns.forEach((c) => c.remove())
    strip.querySelectorAll<HTMLElement>(".col[data-peek-key]").forEach((c) => {
        const top = peekScroll.get(c.dataset.peekKey!)
        if (top !== undefined) c.querySelector(".col__body")!.scrollTop = top
    })
    strip.querySelectorAll<HTMLElement>(".col[data-parent]").forEach((c) => {
        const top = columnScroll.get(c.dataset.parent!)
        if (top !== undefined && keep.has(c.dataset.parent!))
            c.querySelector(".col__body")!.scrollTop = top
    })
    const resultsNow = strip.querySelector<HTMLElement>(".col--results")
    if (
        resultsNow &&
        resultsScroll &&
        resultsScroll.key === resultsNow.dataset.resultsKey
    )
        resultsNow.querySelector(".col__body")!.scrollTop = resultsScroll.top
    renderCrumbs()
    renderKeys()
    renderBox()
    layout()
    watchForNearCharts()
    if (landedOn) {
        const landed = strip.querySelector<HTMLElement>(".is-landed")
        landed?.scrollIntoView({ block: "center", inline: "nearest" })
        setTimeout(() => {
            landedOn = null
            strip
                .querySelectorAll(".is-landed, .is-arriving")
                .forEach((e) => e.classList.remove("is-landed", "is-arriving"))
        }, 1400)
    }
}

// --- Search: what the box finds ---

// Typed words search titles and the full text. Keywords narrow it and snap
// into tags once a space ends them: in: a place, is: a kind, sort: an order.
// Results open as a column right after the place being searched, so the
// tree you came from stays in view; the highlighted result previews beside
// them. A search is one stop in the history, so Back returns to it.
type SortKey = "best" | "new" | "read"
interface Search {
    query: string
    scope: string // a place: the root, an area or a topic
    kinds: string[] // keys of KEYWORD_KINDS
    sort: SortKey
    at: number // the highlighted result
    from: string[] // where you were, for Esc on the results
    // Set once you step into a result: the index in the path of the
    // result's own column. ← from there comes back to the results.
    base?: number
    // How many past the first 3 you asked to see, per section.
    shown?: Record<string, number>
}
const KEYWORD_KINDS: Record<string, { label: string; kinds: string[] }> = {
    overview: {
        label: "Overviews",
        kinds: ["topic-page", "linear-topic-page"],
    },
    article: { label: "Articles", kinds: ["article"] },
    insight: { label: "Data insights", kinds: ["data-insight"] },
    // The tree's "Data" group: what is listed under it in a topic.
    data: {
        label: "Data",
        kinds: ["chart", "narrative-chart", "mdm", "explorer"],
    },
    collection: { label: "Data collections", kinds: ["mdm"] },
    explorer: { label: "Explorers", kinds: ["explorer"] },
    chart: { label: "Charts", kinds: ["chart", "narrative-chart"] },
    text: { label: "Text", kinds: ["text"] },
}
// The search's sections are the tree's groups, in the tree's order, each
// with the keyword that lists all of it.
const SECTION_KEYWORD: Record<string, string> = {
    Overview: "overview",
    Articles: "article",
    "Data insights": "insight",
    Data: "data",
    Text: "text",
}
const SORTS: Record<SortKey, string> = {
    best: "Best match",
    new: "Newest",
    read: "Most read",
}

const isPlace = (id: string): boolean =>
    ["root", "area", "topic"].includes(nodes.get(id)?.kind ?? "")
const placeAbove = (id: string): string =>
    ancestry(id).slice(0, -1).findLast(isPlace) ?? "root"
const scopeName = (scope: string): string =>
    scope === "root" ? "the whole site" : node(scope).title
const slug = (title: string): string =>
    title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

// A place holds what is filed under it or any topic below it, and what is
// tagged there but lives elsewhere.
const placesCache = new Map<string, Set<string>>()
function placesUnder(scope: string): Set<string> {
    if (placesCache.has(scope)) return placesCache.get(scope)!
    const under = new Set<string>()
    const walk = (id: string): void => {
        under.add(id)
        for (const k of childrenOf(id)) if (isPlace(k)) walk(k)
    }
    walk(scope)
    placesCache.set(scope, under)
    return under
}
const inScopeCache = new Map<string, boolean>()
function inScope(id: string, scope: string): boolean {
    if (scope === "root") return true
    const key = `${scope}|${id}`
    let holds = inScopeCache.get(key)
    if (holds === undefined) {
        const under = placesUnder(scope)
        const place = ancestry(id).findLast(isPlace)
        holds =
            (place !== undefined && under.has(place)) ||
            (node(id).alsoIn?.some((t) => under.has(t)) ?? false)
        inScopeCache.set(key, holds)
    }
    return holds
}

// Lower ranks first among equally good title matches.
const TITLE_RANK: Record<string, number> = {
    area: 0,
    topic: 0,
    "topic-page": 1,
    "linear-topic-page": 1,
    article: 2,
    mdm: 2,
    explorer: 2,
    "data-insight": 3,
    chart: 3,
    "narrative-chart": 4,
}
const titleIndex = [...nodes.values()]
    .filter((n) => n.kind in TITLE_RANK)
    .map((n) => ({ id: n.id, title: n.title.toLowerCase() }))

// The full text loads on the first search; titles answer until it lands.
interface TextEntry {
    id: string
    doc: string
    text: string
    lower: string
    heading: boolean
}
let textIndex: TextEntry[] | null = null
let textLoading: Promise<void> | null = null
function loadText(): void {
    textLoading ??= fetch("/data/text.json")
        .then((r) => r.json())
        .then((rows: [string, string, number][]) => {
            textIndex = rows.map(([id, text, heading]) => ({
                id,
                doc: id.split("#")[0],
                text,
                lower: text.toLowerCase(),
                heading: heading === 1,
            }))
            resultsCache.clear()
            // The results change; the new highlight needs its document.
            if (state.search) void setSearch(state.search)
        })
}

interface Result {
    id: string
    text?: TextEntry // set for a match in a document's text
    more?: string // a "show more" row: the section it shows more of
}
interface ResultSection {
    label: string
    results: Result[]
    total: number // before folding
    folds?: boolean // shows 3, then a "show more" row
}
const wordsOf = (query: string): string[] =>
    query.toLowerCase().split(/\s+/).filter(Boolean)
const itemOf = (r: Result): TreeNode => node(r.text?.doc ?? r.id)
const TEXT_LIMIT = 400 // text matches kept, best first
const PLACES_SHOWN = 3 // "Search in" rows above the results

const resultsCache = new Map<string, ResultSection[]>()
function searchResults(s: Search): ResultSection[] {
    const key = JSON.stringify([s.query, s.scope, s.kinds, s.sort, s.shown])
    if (resultsCache.has(key)) return resultsCache.get(key)!
    const words = wordsOf(s.query)
    const query = words.join(" ")
    const allowed = (kind: string): boolean =>
        !s.kinds.length ||
        s.kinds.some((k) => KEYWORD_KINDS[k].kinds.includes(kind))
    // In a document (⌘F), only its own text: matches, or with no words its
    // sections, in reading order.
    if (DOC_KINDS.has(node(s.scope).kind)) {
        loadText()
        const blockOrder = (e: TextEntry): number => Number(e.id.split("#")[1])
        const found = (textIndex ?? [])
            .filter(
                (e) =>
                    e.doc === s.scope &&
                    (words.length
                        ? words.every((w) => e.lower.includes(w))
                        : e.heading)
            )
            .sort((a, b) => blockOrder(a) - blockOrder(b))
            .map((e) => ({ id: e.id, text: e }))
        const out = found.length
            ? [
                  {
                      label: words.length ? "In the text" : "Sections",
                      results: found,
                      total: found.length,
                  },
              ]
            : []
        resultsCache.set(key, out)
        return out
    }

    // Topics and areas are places to search in, not things to read: one
    // whose name you typed is offered first, as a narrower search.
    const places: { r: Result; score: number }[] = []
    const titles: { r: Result; score: number }[] = []
    for (const entry of titleIndex) {
        const kind = node(entry.id).kind
        const place = isPlace(entry.id)
        if (place ? !words.length || entry.id === s.scope : !allowed(kind))
            continue
        if (!words.every((w) => entry.title.includes(w))) continue
        if (!inScope(entry.id, s.scope)) continue
        // The whole query at the start, then at a word start, then anywhere.
        const at = entry.title.indexOf(query)
        const quality =
            at === 0 ? 0 : at > 0 && entry.title[at - 1] === " " ? 1 : 2
        ;(place ? places : titles).push({
            r: { id: entry.id },
            score:
                quality * 100 +
                TITLE_RANK[kind] * 10 +
                entry.title.length / 100,
        })
    }
    let texts: Result[] = []
    if (words.length && allowed("text")) {
        loadText()
        for (const entry of textIndex ?? [])
            if (
                words.every((w) => entry.lower.includes(w)) &&
                inScope(entry.doc, s.scope)
            )
                texts.push({ id: entry.id, text: entry })
        // Section titles first, then the most-read documents.
        texts = texts
            .sort(
                (a, b) =>
                    Number(b.text!.heading) - Number(a.text!.heading) ||
                    (itemOf(b).pop ?? 0) - (itemOf(a).pop ?? 0)
            )
            .slice(0, TEXT_LIMIT)
    }

    const sections = new Map<string, Result[]>()
    const add = (label: string, r: Result): void => {
        if (!sections.has(label)) sections.set(label, [])
        sections.get(label)!.push(r)
    }
    const scoreOf = new Map(titles.map((t) => [t.r, t.score]))
    if (s.sort === "new") {
        const dated = [...titles.map((t) => t.r), ...texts].sort((a, b) =>
            (itemOf(b).date ?? "").localeCompare(itemOf(a).date ?? "")
        )
        for (const r of dated)
            add(itemOf(r).date ? monthName(itemOf(r).date!) : "No date", r)
    } else {
        // Like a place's column: one section per group, in the tree's
        // order. Within one: the best match; with no words, the order of
        // the place's column: what is filed here before what is only tagged
        // here, then the Overview's picks in page order, then the most read.
        const filedElsewhere = (r: Result): number =>
            Number(!placesUnder(s.scope).has(homeOf(r.id)?.id ?? ""))
        const rank = (r: Result): number[] =>
            s.sort === "read"
                ? [-(itemOf(r).pop ?? 0)]
                : words.length
                  ? [scoreOf.get(r) ?? 0]
                  : [
                        filedElsewhere(r),
                        pickOrder(s.scope, r.id),
                        -(itemOf(r).pop ?? 0),
                    ]
        const byRank = (a: Result, b: Result): number => {
            const [ra, rb] = [rank(a), rank(b)]
            for (let i = 0; i < ra.length; i++)
                if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1
            return 0
        }
        const sectionOf = (r: Result): string =>
            r.text ? "Text" : GROUP_OF[node(r.id).kind]
        const all = [...titles.map((t) => t.r).sort(byRank), ...texts]
        for (const label of Object.keys(SECTION_KEYWORD))
            for (const r of all) if (sectionOf(r) === label) add(label, r)
    }
    const searchIn = places
        .sort((a, b) => a.score - b.score)
        .slice(0, PLACES_SHOWN)
        .map((p) => p.r)
    // Unless a kind is asked for, each section shows its first 3, then one
    // "N more" row that asks for its kind, like a place's column does.
    const fold = !s.kinds.length && s.sort !== "new"
    const out: ResultSection[] = [
        ...(searchIn.length
            ? [
                  {
                      label: "Search in",
                      results: searchIn,
                      total: searchIn.length,
                  },
              ]
            : []),
        ...[...sections].map(([label, results]) => {
            const folds = fold && results.length - SHOWN_IN_GROUP >= 2
            const shown = SHOWN_IN_GROUP + (s.shown?.[label] ?? 0)
            return {
                label,
                total: results.length,
                folds,
                results:
                    folds && shown < results.length
                        ? [
                              ...results.slice(0, shown),
                              { id: `more:${label}`, more: label },
                          ]
                        : results,
            }
        }),
    ]
    resultsCache.set(key, out)
    return out
}
const flatResults = (s: Search): Result[] =>
    searchResults(s).flatMap((x) => x.results)
const highlighted = (s: Search): Result | undefined => flatResults(s)[s.at]

const monthName = (date: string): string =>
    new Date(date).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
    })

// The words found, marked where they appear.
function marked(text: string, words: string[]): DocumentFragment {
    const out = document.createDocumentFragment()
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    if (!escaped.length) {
        out.append(text)
        return out
    }
    for (const [i, part] of text
        .split(new RegExp(`(${escaped.join("|")})`, "gi"))
        .entries())
        out.append(i % 2 ? el("mark", "", part) : part)
    return out
}
// A paragraph's text around its first match, cut at word ends.
function snippet(text: string, words: string[]): string {
    const lower = text.toLowerCase()
    const at = Math.min(
        ...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0)
    )
    if (!Number.isFinite(at) || at < 60) return text
    const from = text.lastIndexOf(" ", at - 40)
    return `…${text.slice(from + 1)}`
}

function resultRow(r: Result, i: number, s: Search): HTMLElement {
    const words = wordsOf(s.query)
    const row = el("div", "row result")
    row.dataset.result = String(i)
    row.setAttribute("role", "option")
    if (i === s.at) {
        row.classList.add(s.base === undefined ? "is-selected" : "is-trail")
        row.setAttribute("aria-selected", "true")
    }
    if (r.more) {
        const section = searchResults(s).find((x) => x.label === r.more)!
        const left = section.total - SHOWN_IN_GROUP - (s.shown?.[r.more] ?? 0)
        row.classList.add("row--more")
        row.append(
            icon("show-more"),
            el(
                "span",
                "row__text",
                el("span", "row__title", showMoreLabel(left, r.more))
            ),
            seeAllOnRow(section.total, SECTION_KEYWORD[r.more])
        )
        return row
    }
    const item = itemOf(r)
    row.classList.add(`row--${r.text ? "text" : item.kind}`)
    if (isPlace(r.id) && !r.text) {
        const above = node(placeAbove(r.id))
        row.classList.add("result--place")
        row.append(
            kindIcon(item.kind) ?? "",
            el(
                "span",
                "row__text",
                el("span", "row__title", marked(item.title, words)),
                el(
                    "span",
                    "row__meta",
                    above.id === "root" ? "Area" : `Topic in ${above.title}`
                )
            )
        )
        return row
    }
    const place = ancestry(item.id).findLast(isPlace)
    const where =
        place && place !== s.scope && place !== "root"
            ? `in ${node(place).title}`
            : null
    if (r.text) {
        row.append(
            icon(r.text.heading ? "section" : "paragraph"),
            el(
                "span",
                "row__text",
                el(
                    "span",
                    `row__title result__snippet ${r.text.heading ? "result__snippet--heading" : ""}`,
                    marked(snippet(r.text.text, words), words)
                ),
                el(
                    "span",
                    "row__meta",
                    // Inside one document, the section says where; across
                    // documents, the document does.
                    r.text.doc === s.scope
                        ? (nodes.get(nodes.get(r.id)?.parent ?? "")?.title ??
                              "")
                        : [item.title, where].filter(Boolean).join(" · ")
                )
            )
        )
        row.querySelector(".icon")!.classList.add("kind-icon")
        return row
    }
    if (
        (item.kind === "chart" || item.kind === "narrative-chart") &&
        item.thumb
    )
        row.append(thumb(item.thumb, "row__thumb", 240))
    else row.append(kindIcon(item.kind) ?? "")
    const meta = [
        KIND_LABEL[item.kind],
        s.sort === "new" && item.date ? item.date.slice(0, 10) : null,
        where,
    ]
    row.append(
        el(
            "span",
            "row__text",
            el("span", "row__title", marked(item.title, words)),
            el("span", "row__meta", meta.filter(Boolean).join(" · "))
        )
    )
    return row
}

const SHOWN = 100 // results rendered at once; more come as you move down
function resultsColumn(s: Search): HTMLElement {
    const col = el("section", "col col--results")
    col.dataset.search = "results"
    col.dataset.resultsKey = JSON.stringify([s.query, s.scope, s.kinds, s.sort])
    col.setAttribute("role", "listbox")
    col.setAttribute("aria-label", `Results in ${scopeName(s.scope)}`)
    const sections = searchResults(s)
    const total = sections.reduce((sum, x) => sum + x.total, 0)
    const waiting = wordsOf(s.query).length > 0 && !textIndex
    const head = el(
        "header",
        "results__head",
        el(
            "span",
            "results__count",
            `${total.toLocaleString("en-GB")}${total >= TEXT_LIMIT && wordsOf(s.query).length ? "+" : ""} ${total === 1 ? "result" : "results"}`
        ),
        el("span", "results__where", `in ${scopeName(s.scope)}`),
        waiting ? el("span", "results__note", "Reading the text…") : null
    )
    // What the keys do here, said where you look: on the results, or
    // inside one of them with the results still on the left.
    const hint = (k: string, label: string): HTMLElement[] => [
        el("kbd", "", k),
        el("span", "", label),
    ]
    const hints = el(
        "div",
        "results__hints",
        ...(s.base === undefined
            ? [
                  ...enterHints(s).flatMap(([k, label]) => hint(k, label)),
                  ...hint("←", "back"),
              ]
            : [
                  ...hint("←", "back to the results"),
                  ...hint("esc", "stay here, close the search"),
              ])
    )
    head.prepend(icon("search"))
    head.append(hints)
    const chips = kindChips(s)
    if (chips) head.append(chips)
    const body = el("div", "col__body")
    const shown = Math.max(SHOWN, s.at + 40)
    let i = 0
    for (const { label, results, total, folds } of sections) {
        if (i >= shown) break
        body.append(
            groupLabel(
                label,
                total,
                folds ? { kind: SECTION_KEYWORD[label] } : undefined
            )
        )
        for (const r of results.slice(0, shown - i))
            body.append(resultRow(r, i++, s))
    }
    if (total > shown) {
        const more = el(
            "button",
            "results__more",
            `Show more (${(total - shown).toLocaleString("en-GB")} left)`
        )
        more.dataset.more = String(shown)
        body.append(more)
    }
    if (!total && !waiting) {
        body.append(
            el("p", "col__empty", `Nothing in ${scopeName(s.scope)} matches.`)
        )
        if (s.scope !== "root") {
            const wider = el(
                "button",
                "results__wider",
                `Search ${scopeName(placeAbove(s.scope))} instead`,
                el("kbd", "", "⌫")
            )
            wider.dataset.widen = "1"
            body.append(wider)
        }
    }
    col.append(head, body)
    return col
}

// One chip per group the search finds, to list all of one kind: the
// clickable form of is:. Counts are of the search without a kind.
function kindChips(s: Search): HTMLElement | null {
    if (DOC_KINDS.has(node(s.scope).kind) || s.sort === "new") return null
    const counts = searchResults({ ...s, kinds: [] }).filter(
        (x) => x.label in SECTION_KEYWORD
    )
    if (counts.length < 2 && !s.kinds.length) return null
    const chip = (key: string, label: string, count?: number): HTMLElement => {
        const on = key ? s.kinds.join() === key : !s.kinds.length
        const b = el(
            "button",
            `chip ${on ? "is-on" : ""}`,
            label,
            count === undefined
                ? null
                : el("span", "chip__count", String(count))
        )
        b.dataset.kind = key
        b.setAttribute("aria-pressed", String(on))
        return b
    }
    return el(
        "div",
        "results__kinds",
        chip("", "All"),
        ...counts.map((x) => chip(SECTION_KEYWORD[x.label], x.label, x.total))
    )
}

// Left of the results: the place being searched, in its tree. Right of
// them, render() adds the highlighted result in its own place in the tree.
function searchColumns(s: Search): HTMLElement[] {
    const path = ancestry(s.scope)
    const cols: HTMLElement[] = []
    for (let i = 0; i < path.length - 1; i++) {
        const col = treeColumn(path[i], path[i + 1], i, true)
        col.dataset.search = "scope"
        const spine = el(
            "button",
            "spine",
            el("span", "spine__label", node(path[i + 1]).title)
        )
        spine.dataset.scope = path[i + 1]
        col.prepend(spine)
        cols.push(col)
    }
    cols[cols.length - 1]
        ?.querySelector(`[data-id="${CSS.escape(s.scope)}"]`)
        ?.classList.add("is-scope")
    const results = resultsColumn(s)
    if (s.base === undefined) results.classList.add("is-focus")
    // Deep inside a result, the results fold like any column on the left.
    const spine = el(
        "button",
        "spine spine--results",
        icon("search"),
        el("span", "spine__label", s.query.trim() || searchTitle(s))
    )
    spine.dataset.resultsSpine = "1"
    spine.title = "Back to the results (←)"
    results.prepend(spine)
    cols.push(results)
    return cols
}
// Searches change as you type. Each change waits for the highlighted
// result's document, then shows; a later keystroke wins over an earlier one.
let latestSearch: Search | null = null
let searchPending = false // latestSearch is on its way to the screen
async function setSearch(s: Search | null): Promise<void> {
    latestSearch = s
    searchPending = true
    const r = s && highlighted(s)
    const doc = r && docOf(r.id)
    if (doc) await loadDoc(doc)
    if (latestSearch !== s) return
    searchPending = false
    await go({
        path: s && s.base === undefined ? s.from : state.path,
        peek: null,
        search: s ?? undefined,
    })
}
async function moveResult(delta: number): Promise<void> {
    const s = state.search
    if (!s) return
    const count = flatResults(s).length
    const at = Math.max(0, Math.min(count - 1, s.at + delta))
    if (at !== s.at) await setSearch({ ...s, at })
}
// The results stand in for the column of the place searched, so the tree
// right of them starts below that place and runs down to the result: you
// see where it lives, and ← climbs back up to the results. A result filed
// elsewhere (only tagged into the place) starts below its own topic.
function resultBase(id: string, s: Search): number {
    const path = ancestry(id)
    const scopeAt = path.indexOf(s.scope)
    const at = scopeAt >= 0 ? scopeAt : path.findLastIndex(isPlace)
    return Math.min(at + 1, path.length - 2)
}
// → steps into the highlighted result: the columns after the results
// become the tree, and the arrows move in it.
async function enterResult(): Promise<void> {
    const s = state.search
    const r = s && highlighted(s)
    if (!s || !r) return
    if (r.more) return showMoreResults(s, r.more)
    // → moves one column, like everywhere else: into the first column
    // right of the results, on the way to the match.
    await enterAt(ancestry(r.id)[resultBase(r.id, s) + 1])
}
// ⏎ opens what you're on and ends the search: the match, however deep it
// sits, or the place. → only looks inside and keeps the search; ⌫ (Back)
// brings an ended search back. On a "Show more" row, → and ⏎ show more
// there, and ⌘⏎ sees all of it.
async function openMatch(): Promise<void> {
    const s = state.search
    const r = s && highlighted(s)
    if (!s || !r) return
    if (r.more) return showMoreResults(s, r.more)
    leaveBox()
    await jumpTo(r.id)
}
// The next ones take the row's place, so the highlight lands on the
// first of them.
function showMoreResults(s: Search, section: string): void {
    const shown = {
        ...s.shown,
        [section]: (s.shown?.[section] ?? 0) + SHOW_MORE_STEP,
    }
    void setSearch({ ...s, shown, base: undefined })
}
// A place's "show more" row shows the next ones in place, on the first.
function showMoreRows(path: string[]): void {
    const moreId = path[path.length - 1]
    const before = extraShown(moreId)
    shownMore.set(
        moreId,
        Math.min(node(moreId).count!, before + SHOW_MORE_STEP)
    )
    const first = childrenOf(node(moreId).parent!).find((k) => {
        const fold = foldOf.get(k)
        return fold?.more === moreId && fold.at === SHOWN_IN_GROUP + before
    })!
    void go({ path: [...path.slice(0, -1), first], peek: null })
}
// ⌘⏎ on a "Show more" row: what its "See all" does.
function seeAllFromRow(): void {
    const s = state.search
    const r = s && s.base === undefined && highlighted(s)
    if (r) {
        if (r.more) seeAll(SECTION_KEYWORD[r.more])
        return
    }
    const n = node(selected())
    if (n.kind === "more") seeAll(SECTION_KEYWORD[n.title], n.parent)
}
// "See all" on a group's label: the whole group, as a search of its kind.
function seeAll(kind: string, place?: string): void {
    const s = state.search
    if (s && !place) return updateSearch({ ...s, kinds: [kind], at: 0 })
    leaveBox()
    void setSearch({
        query: "",
        scope: place ?? hereScope(),
        kinds: [kind],
        sort: "best",
        at: 0,
        from: s?.from ?? state.path,
    })
}
// What → and ⏎ do on the highlighted result, in a few words.
function enterHints(s: Search): [string, string][] {
    return highlighted(s)?.more
        ? [
              ["→ ⏎", "show them here"],
              ["⌘⏎", "see all"],
          ]
        : [
              ["→", "look inside"],
              ["⏎", "open, end the search"],
          ]
}
// While stepped in, the way down to the highlighted result, as long as the
// selection is still on it.
function searchTarget(): string[] | undefined {
    const s = state.search
    const r = s?.base !== undefined && s && highlighted(s)
    if (!r || !nodes.has(r.id)) return undefined
    const path = ancestry(r.id)
    return state.path.every((id, i) => path[i] === id) ? path : undefined
}
async function enterAt(id: string): Promise<void> {
    const s = state.search
    const r = s && highlighted(s)
    if (!s || !r) return
    leaveBox()
    const doc = docOf(id)
    if (doc) await loadDoc(doc)
    const base = resultBase(r.id, s)
    await go({ path: ancestry(id), peek: null, search: { ...s, base } })
}
// ← from the result's own column: back on the results, as you left them.
async function leaveResult(): Promise<void> {
    const s = state.search
    if (s)
        await go({
            path: s.from,
            peek: null,
            search: { ...s, base: undefined },
        })
}
// Esc on the results: back where you were, as if you never searched.
function closeSearch(): void {
    leaveBox()
    endSearch()
}
// Ending a search puts the tree back as it was; the box keeps its focus,
// so clearing the words to type a keyword doesn't throw you out.
function endSearch(): void {
    latestSearch = null
    const from = state.search?.from ?? state.path
    void go({ path: from, peek: null, search: undefined })
}
// Backspace at the start of the box takes the last tag off: the order,
// then kinds, then the place widens one level at a time.
function widen(s: Search): Search {
    if (s.sort !== "best") return { ...s, sort: "best", at: 0 }
    if (s.kinds.length) return { ...s, kinds: s.kinds.slice(0, -1), at: 0 }
    return { ...s, scope: placeAbove(s.scope), at: 0 }
}

function handleSearchClick(t: HTMLElement, zone: string): void {
    const s = state.search!
    const row = t.closest<HTMLElement>(".row[data-id]")
    const spine = t.closest<HTMLElement>("[data-scope]")
    if (zone === "results") {
        const result = t.closest<HTMLElement>("[data-result]")
        const more = t.closest<HTMLElement>("[data-more]")
        const chip = t.closest<HTMLElement>("[data-kind]")
        if (chip) {
            const kind = chip.dataset.kind!
            updateSearch({ ...s, kinds: kind ? [kind] : [], at: 0 })
        } else if (result) {
            const at = Number(result.dataset.result)
            const r = flatResults(s)[at]
            if (r?.more) showMoreResults(s, r.more)
            else if (at === s.at) void enterResult()
            else void setSearch({ ...s, at, base: undefined })
        } else if (t.closest("[data-results-spine]")) void leaveResult()
        else if (more) void setSearch({ ...s, at: Number(more.dataset.more) })
        else if (t.closest("[data-widen]")) updateSearch(widen(s))
    } else if (zone === "scope") {
        // Other places in the tree become the place searched.
        const id = spine?.dataset.scope ?? row?.dataset.id
        if (id && isPlace(id)) updateSearch({ ...s, scope: id, at: 0 })
        else if (id) {
            leaveBox()
            void jumpTo(id)
        }
    } else if (row) {
        // The look at a result is its real place: clicking steps in there.
        void enterAt(row.dataset.id!)
    }
}

// --- Mouse ---

strip.addEventListener("click", (e) => {
    const t = e.target as HTMLElement
    const all = t.closest<HTMLElement>("[data-see-all]")
    if (all) return seeAll(all.dataset.seeAll!, all.dataset.place)
    const zone = t.closest<HTMLElement>("[data-search]")?.dataset.search
    if (state.search && zone) return handleSearchClick(t, zone)
    const refsPill = t.closest<HTMLElement>("[data-refs]")
    const spine = t.closest<HTMLElement>(".spine")
    if (spine)
        return void go({
            path: state.path.slice(0, Number(spine.dataset.crumb) + 1),
            peek: null,
        })
    const peekRow = t.closest<HTMLElement>("[data-peek-row]")
    const peekLink = t.closest<HTMLElement>("[data-peek-link]")
    if (peekLink) {
        // External rows are real links: the browser opens them.
        const link = Number(peekLink.dataset.peekLink)
        return void go({ ...state, peek: { zone: "links", link, row: 0 } })
    }
    if (peekRow) {
        const row = Number(peekRow.dataset.peekRow)
        const link = state.peek?.link ?? 0
        const already = state.peek?.zone === "target" && state.peek.row === row
        if (already || e.detail > 1) return void enter()
        return void go({ ...state, peek: { zone: "target", link, row } })
    }
    const row = t.closest<HTMLElement>(".row[data-id]")
    if (!row) return
    const id = row.dataset.id!
    const col = row.closest<HTMLElement>(".col")!
    const depth = Number(col.dataset.depth)
    const inline = t.closest<HTMLElement>(".inline-link")
    const path = [...state.path.slice(0, depth + 1), id]
    if (refsPill) {
        void go({ path, peek: null }).then(() => {
            referencesOpen = true
            render(state)
        })
        return
    }
    if (inline)
        return void go({
            path,
            peek: { zone: "links", link: Number(inline.dataset.link), row: 0 },
        })
    if (node(id).kind === "more") return showMoreRows(path)
    if (e.detail > 1 && node(id).kind === "alias")
        return void jumpTo(node(id).target!)
    void go({ path, peek: null })
})
crumbs.addEventListener("click", (e) => {
    const scope = (e.target as HTMLElement).closest<HTMLElement>("[data-scope]")
    if (scope && state.search)
        return updateSearch({
            ...state.search,
            scope: scope.dataset.scope!,
            at: 0,
        })
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-crumb]")
    if (li)
        void go({
            path: state.path.slice(0, Number(li.dataset.crumb) + 1),
            peek: null,
        })
})
tramline.addEventListener("click", (e) => {
    const stop = (e.target as HTMLElement).closest<HTMLElement>("[data-stop]")
    if (stop) void goToStop(Number(stop.dataset.stop))
})
document
    .querySelector('[data-action="home"]')!
    .addEventListener("click", () => {
        leaveBox()
        void go({ path: ["root"], peek: null, search: undefined })
    })
document
    .querySelector('[data-action="back"]')!
    .addEventListener("click", () => void back())
document
    .querySelector('[data-action="forward"]')!
    .addEventListener("click", () => void forward())
window.addEventListener("resize", () => layout())
// Typed or pasted addresses jump like links do.
window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1))
    if (id && id !== selected()) void jumpTo(id)
})

// --- The box: one place to find and to do ---

// Words search (the search above). A leading ">" turns the box into
// commands on the row you're on; deleting it turns it back. The tag at the
// left always says what the box acts on: in a place, or on a row.
// / and ⌘K focus it to search; ⌘⇧K opens it on commands.
interface Command {
    label: string
    detail?: string
    icon: string
    keys?: string
    run: () => void | Promise<void>
}
const box = document.querySelector<HTMLElement>(".omnibox")!
const boxInput = box.querySelector<HTMLInputElement>(".omnibox__input")!
const boxTags = box.querySelector<HTMLElement>(".omnibox__tags")!
const boxMenu = box.querySelector<HTMLElement>(".omnibox__menu")!
const boxKey = box.querySelector<HTMLElement>(".omnibox__key")!
let menuGroups: { title: string; commands: Command[] }[] = []
let menuActive = 0
let wasCommands = false

const matches = (text: string, words: string[]): boolean =>
    words.every((w) => text.toLowerCase().includes(w))
const inCommands = (): boolean => boxInput.value.startsWith(">")
// A search is on as soon as it asks for anything the tree doesn't show:
// words, a kind, an order, or another place than the one you're in.
const isActive = (s: Search): boolean =>
    s.query.trim() !== "" ||
    s.kinds.length > 0 ||
    s.sort !== "best" ||
    s.scope !== hereScope()
// The place you're in: the nearest topic or area above the selection.
const hereScope = (): string => state.path.findLast(isPlace) ?? "root"
// The search the box shows: the one being typed, even before it lands.
const boxSearch = (): Search =>
    (searchPending ? latestSearch : state.search) ?? {
        query: "",
        scope: hereScope(),
        kinds: [],
        sort: "best",
        at: 0,
        from: state.path,
    }
// Changing what you search for puts you back on the results.
function updateSearch(changed: Search): void {
    const s = { ...changed, base: undefined, shown: undefined }
    if (isActive(s)) void setSearch(s)
    else {
        if (state.search) endSearch()
        else renderBox()
    }
}

// --- Keywords ---

const KEYWORDS: [string, string][] = [
    ["in:", "a topic, or in:site for everything"],
    ["is:", "article, insight, chart, text, …"],
    ["sort:", "new or read"],
    [">", "commands for the selected row"],
]
const PARTIAL = /(?:^|\s)(in|is|sort):(\S*)$/
const DONE = /(?:^|\s)(in|is|sort):(\S+)\s/
const placeList = [...nodes.values()].filter((n) => isPlace(n.id))
// Candidates for a keyword's value, best first.
function keywordValues(
    key: string,
    value: string
): {
    label: string
    detail: string
    icon: string
    apply: (s: Search) => Search
}[] {
    const v = value.toLowerCase()
    if (key === "in") {
        const site = {
            label: "site",
            detail: "Everything on Our World in Data",
            icon: "search",
            apply: (s: Search) => ({ ...s, scope: "root" }),
        }
        const toPlace = (n: TreeNode) => ({
            label: slug(n.title),
            detail: `${n.title} · ${KIND_LABEL[n.kind]}`,
            icon: "topic",
            apply: (s: Search) => ({ ...s, scope: n.id }),
        })
        if (!v)
            return [
                // The places above the one searched, nearest first.
                ...ancestry(boxSearch().scope)
                    .slice(1, -1)
                    .reverse()
                    .map((id) => toPlace(node(id))),
                site,
            ]
        const places = placeList
            .filter((n) => n.id !== "root")
            .map((n) => ({ n, at: slug(n.title).indexOf(v) }))
            .filter(({ at }) => at >= 0)
            .sort(
                (a, b) =>
                    Number(a.at !== 0) - Number(b.at !== 0) ||
                    a.n.title.length - b.n.title.length
            )
            .slice(0, 8)
            .map(({ n }) => toPlace(n))
        return ["site", "all", "everything"].some((w) => w.startsWith(v))
            ? [site, ...places]
            : places
    }
    if (key === "is")
        return Object.entries(KEYWORD_KINDS)
            .filter(([k]) => k.startsWith(v))
            .map(([k, { label, kinds }]) => ({
                label: k,
                detail: label,
                icon: KIND_ICON[kinds[0]] ?? "paragraph",
                apply: (s: Search) => ({
                    ...s,
                    kinds: s.kinds.includes(k) ? s.kinds : [...s.kinds, k],
                }),
            }))
    return (Object.keys(SORTS) as SortKey[])
        .filter((k) => k.startsWith(v))
        .map((k) => ({
            label: k,
            detail: SORTS[k],
            icon: "refs",
            apply: (s: Search) => ({ ...s, sort: k }),
        }))
}

// A keyword ended by a space becomes a tag; one with no match stays text.
function onBoxInput(): void {
    if (inCommands()) {
        wasCommands = true
        return renderBox()
    }
    if (wasCommands) {
        // Deleting the ">" brings the search back as it was.
        wasCommands = false
        boxInput.value = state.search?.query ?? ""
        return renderBox()
    }
    // A keyword still being typed is not searched as text.
    let s: Search = {
        ...boxSearch(),
        query: boxInput.value.replace(PARTIAL, ""),
        at: 0,
    }
    for (let m = s.query.match(DONE); m; m = s.query.match(DONE)) {
        const [first] = keywordValues(m[1], m[2])
        if (!first) break
        const rest =
            s.query.slice(0, m.index) +
            " " +
            s.query.slice(m.index! + m[0].length)
        s = { ...first.apply(s), query: rest.trimStart() }
        boxInput.value = s.query
    }
    updateSearch(s)
    renderBox()
}
// Picking a keyword's value from the menu applies it straight away.
function applyKeyword(apply: (s: Search) => Search): void {
    const query = boxInput.value.replace(PARTIAL, "").trimEnd()
    boxInput.value = query ? `${query} ` : ""
    updateSearch({ ...apply(boxSearch()), query: boxInput.value, at: 0 })
    renderBox()
}

// --- Commands ---

// Commands act on what you look at: the highlighted result while a search
// is open, else the selected row.
function commandTarget(): { id: string; path: string[] } {
    const s = state.search
    const r = s && s.base === undefined && highlighted(s)
    return r && nodes.has(r.id)
        ? { id: r.id, path: ancestry(r.id) }
        : { id: selected(), path: state.path }
}

function showReferences(): void {
    const id = selected()
    if (hasChildren(id)) {
        referencesOpen = true
        render(state)
    } else void go({ ...state, peek: { zone: "target", link: 0, row: 0 } })
}

// What you can do with the selected row. Each kind only gets the actions
// that mean something for it.
function selectionCommands(): Command[] {
    const { id, path } = commandTarget()
    const n = node(id)
    // From a search result, a command that works on the row goes there first.
    const there = (run: () => void | Promise<void>) => async () => {
        if (onResults()) await jumpTo(id)
        await run()
    }
    const out: Command[] = []
    // Links leave the block; following one is a jump.
    for (const l of n.kind === "embed" ? [] : (n.links ?? [])) {
        if (l.target)
            out.push({
                label: `Follow “${l.text}”`,
                detail: node(l.target).title,
                icon: "jump",
                run: () => jumpTo(l.target!),
            })
        else
            out.push({
                label: `Open “${l.text}”`,
                detail: new URL(l.url ?? "", "https://ourworldindata.org")
                    .hostname,
                icon: "external",
                run: () => void window.open(l.url, "_blank", "noopener"),
            })
    }
    // Rows standing in for something that lives elsewhere.
    const target = n.kind === "title" ? undefined : (n.target ?? undefined)
    if (target && nodes.has(target) && !isAtHome(target))
        out.push({
            label: `Go to where it lives`,
            detail: node(target).title,
            icon: "jump",
            run: () => jumpTo(target),
        })
    const refCount = references[n.kind === "title" ? n.target! : id]?.length
    if (refCount)
        out.push({
            label: "Show where it’s used",
            detail: `${refCount} place${refCount === 1 ? "" : "s"}`,
            icon: "refs",
            keys: "R",
            run: there(showReferences),
        })
    // The page this row is part of, on the live site. A chart embed opens
    // the chart itself.
    const doc = docOf(id)
    const url = n.url ?? (doc ? node(doc).url : undefined)
    if (url)
        out.push({
            label:
                n.kind === "embed"
                    ? "Open the interactive chart"
                    : "Open on ourworldindata.org",
            detail: new URL(url).pathname,
            icon: "external",
            run: () => void window.open(url, "_blank", "noopener"),
        })
    if (path.length > 2) {
        const parent = node(path[path.length - 2])
        out.push({
            label: `Up to ${parent.title}`,
            icon: "up",
            keys: "←",
            run: () => go({ path: path.slice(0, -1), peek: null }),
        })
        // The keyboard's way to a group label's "See all".
        const group = n.kind === "more" ? n.title : groupOf(id)
        const more = group && nodes.get(`more:${parent.id}:${group}`)
        if (group && more)
            out.push({
                label: `See all ${SHOWN_IN_GROUP + more.count!} ${GROUP_NOUN[group][1]}`,
                detail: `In ${parent.title}, as a search`,
                icon: "search",
                run: () => seeAll(SECTION_KEYWORD[group], parent.id),
            })
    }
    out.push({
        label: "Copy link to this place",
        icon: "copy",
        run: () =>
            navigator.clipboard.writeText(
                `${location.origin}${location.pathname}#${encodeURIComponent(id)}`
            ),
    })
    return out
}

function historyCommands(): Command[] {
    const out: Command[] = []
    if (stopIndex > 0)
        out.push({
            label: `Back to ${stopTitle(trail[stopIndex - 1])}`,
            icon: "back",
            keys: "⌫",
            run: back,
        })
    if (stopIndex < trail.length - 1)
        out.push({
            label: `Forward to ${stopTitle(trail[stopIndex + 1])}`,
            icon: "forward",
            keys: "⇧⌫",
            run: forward,
        })
    return out
}

// Places visited before, most recent first, once each.
function recentCommands(): Command[] {
    const seen = new Set([placeOf(state), "search"])
    const out: Command[] = []
    for (let i = trail.length - 1; i >= 0 && out.length < 5; i--) {
        const place = placeOf(trail[i].at)
        if (seen.has(place)) continue
        seen.add(place)
        out.push({
            label: node(place).title,
            detail: KIND_LABEL[node(place).kind],
            icon: "back",
            run: () => goToStop(i),
        })
    }
    return out
}

function selectionNoun(): string {
    const n = node(commandTarget().id)
    const kind = n.kind === "title" ? node(n.target!).kind : n.kind
    return kindName(kind)
}
function selectionName(): string {
    const n = node(commandTarget().id)
    const text = n.title || plain(n.spans ?? n.items?.[0] ?? [])
    return text.length > 44 ? `${text.slice(0, 42)}…` : text
}

// --- Menu ---

function menuFor(): { title: string; commands: Command[] }[] {
    if (inCommands()) {
        const words = wordsOf(boxInput.value.slice(1))
        return [
            {
                title: `This ${selectionNoun()}`,
                commands: selectionCommands().filter((c) =>
                    matches(c.label, words)
                ),
            },
            {
                title: "History",
                commands: historyCommands().filter((c) =>
                    matches(c.label, words)
                ),
            },
            {
                title: "Recent places",
                commands: recentCommands().filter((c) =>
                    matches(c.label, words)
                ),
            },
        ].filter((g) => g.commands.length)
    }
    const partial = boxInput.value.match(PARTIAL)
    if (partial) {
        const values = keywordValues(partial[1], partial[2])
        return [
            {
                title: { in: "Search in", is: "Only", sort: "Order" }[
                    partial[1]
                ]!,
                commands: values.map((v) => ({
                    label: `${partial[1]}:${v.label}`,
                    detail: v.detail,
                    icon: v.icon,
                    keys: "⇥",
                    run: () => applyKeyword(v.apply),
                })),
            },
        ].filter((g) => g.commands.length)
    }
    // An empty box teaches its keywords.
    if (!boxInput.value && !state.search)
        return [
            {
                title: "Narrow it down",
                commands: KEYWORDS.map(([keyword, detail]) => ({
                    label: keyword,
                    detail,
                    icon: keyword === ">" ? "command" : "search",
                    run: () => {
                        boxInput.value = keyword
                        onBoxInput()
                    },
                })),
            },
        ]
    return []
}
const menuCommands = (): Command[] => menuGroups.flatMap((g) => g.commands)
function renderMenu(): void {
    const focused = document.activeElement === boxInput
    const groups = focused ? menuFor() : []
    // A new list starts at its top; the same list keeps its place.
    const sameList =
        JSON.stringify(groups.map((g) => g.commands.map((c) => c.label))) ===
        JSON.stringify(menuGroups.map((g) => g.commands.map((c) => c.label)))
    menuGroups = groups
    if (!sameList) menuActive = 0
    boxMenu.hidden = !groups.length
    boxInput.setAttribute("aria-expanded", String(groups.length > 0))
    boxMenu.replaceChildren()
    let index = 0
    for (const g of groups) {
        const group = el("div", "menu__group")
        group.setAttribute("role", "group")
        group.append(el("div", "menu__group-label", g.title))
        for (const c of g.commands) {
            const active = index === menuActive
            const item = el(
                "div",
                `menu__item ${active ? "is-active" : ""}`,
                icon(c.icon),
                el("span", "menu__label", c.label),
                c.detail ? el("span", "menu__detail", c.detail) : null,
                c.keys && active ? el("kbd", "", c.keys) : null
            )
            item.id = `menu-item-${index}`
            item.setAttribute("role", "option")
            item.setAttribute("aria-selected", String(active))
            item.dataset.index = String(index++)
            group.append(item)
        }
        boxMenu.append(group)
    }
    if (inCommands() && !index) {
        boxMenu.hidden = false
        boxMenu.append(
            el("p", "menu__empty", "No command matches. Try fewer words.")
        )
    }
    if (index)
        boxInput.setAttribute(
            "aria-activedescendant",
            `menu-item-${menuActive}`
        )
    else boxInput.removeAttribute("aria-activedescendant")
    boxMenu.querySelector(".is-active")?.scrollIntoView({ block: "nearest" })
}
function runMenu(i: number): void {
    const command = menuCommands()[i]
    if (!command) return
    if (inCommands()) {
        leaveBox()
        keyQueue = keyQueue.then(command.run).catch(console.error)
    } else void command.run()
}

// --- The box itself ---

function tag(
    className: string,
    keyword: string,
    value: string,
    remove?: string
): HTMLElement {
    const t = el(
        remove ? "button" : "span",
        `tag ${className}`,
        el("span", "tag__key", keyword),
        el("span", "tag__value", value)
    )
    if (remove) {
        t.dataset.remove = remove
        t.title = `Remove ${keyword}${value}`
        t.append(el("span", "tag__x", "×"))
    }
    return t
}
function renderBox(): void {
    const commands = inCommands()
    box.dataset.mode = commands ? "commands" : "search"
    const modeIcon = icon(commands ? "command" : "search")
    modeIcon.classList.add("omnibox__icon")
    box.querySelector(".omnibox__icon")!.replaceWith(modeIcon)
    const s = boxSearch()
    boxTags.replaceChildren(
        ...(commands
            ? [tag("tag--on", "on ", selectionName())]
            : [
                  tag(
                      "tag--in",
                      "in ",
                      s.scope === "root" ? "Whole site" : node(s.scope).title,
                      s.scope === "root" ? undefined : "scope"
                  ),
                  ...s.kinds.map((k) =>
                      tag("tag--is", "is ", KEYWORD_KINDS[k].label, `kind:${k}`)
                  ),
                  ...(s.sort === "best"
                      ? []
                      : [tag("tag--sort", "sort ", SORTS[s.sort], "sort")]),
              ])
    )
    boxInput.placeholder = commands ? "" : `Search ${scopeName(s.scope)}`
    const focused = document.activeElement === boxInput
    // Back to a search shows its words; leaving one empties the box.
    if (!focused) boxInput.value = state.search?.query ?? ""
    boxKey.textContent = focused ? "esc" : "/"
    renderMenu()
}
function openBox(prefix?: string): void {
    boxInput.focus()
    if (prefix) {
        boxInput.value = prefix
        onBoxInput()
    } else boxInput.select()
}
// ⌘F: search inside the document you're looking at, like a browser's
// find in page; Backspace at the start widens to its topic.
function openFind(): void {
    const doc = docOf(commandTarget().id)
    if (!doc) return openBox()
    boxInput.focus()
    boxInput.value = ""
    updateSearch({
        ...boxSearch(),
        query: "",
        kinds: [],
        sort: "best",
        scope: doc,
        at: 0,
        from: state.search?.from ?? state.path,
    })
}
// Leaving the box: commands are done, and the strip takes the keys again.
function leaveBox(): void {
    if (inCommands()) {
        wasCommands = false
        boxInput.value = state.search?.query ?? ""
    }
    boxInput.blur()
    strip.focus()
}

boxInput.addEventListener("input", onBoxInput)
boxInput.addEventListener("focus", renderBox)
boxInput.addEventListener("blur", () => {
    if (inCommands()) {
        wasCommands = false
        boxInput.value = state.search?.query ?? ""
    }
    renderBox()
})
boxInput.addEventListener("keydown", (e) => {
    // The strip's own keys must not see what the box handles.
    e.stopPropagation()
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        return openBox(e.shiftKey ? ">" : undefined)
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        return openFind()
    }
    const count = menuCommands().length
    const menuOpen = !boxMenu.hidden && count > 0
    const atStart = boxInput.selectionStart === 0 && boxInput.selectionEnd === 0
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const delta = e.key === "ArrowDown" ? 1 : -1
        if (menuOpen) {
            menuActive = (menuActive + delta + count) % count
            renderMenu()
        } else queueKey(() => moveResult(delta))
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !menuOpen) {
        e.preventDefault()
        seeAllFromRow()
    } else if (e.key === "Enter") {
        e.preventDefault()
        if (menuOpen) runMenu(menuActive)
        else queueKey(openMatch)
    } else if (
        e.key === "ArrowRight" &&
        !menuOpen &&
        state.search &&
        boxInput.selectionStart === boxInput.value.length
    ) {
        // At the end of the words, → steps into the highlighted result.
        e.preventDefault()
        queueKey(enterResult)
    } else if (e.key === "Tab" && menuOpen && !inCommands()) {
        e.preventDefault()
        runMenu(menuActive)
    } else if (e.key === "Escape") {
        e.preventDefault()
        if (inCommands() || !state.search) leaveBox()
        else closeSearch()
    } else if (e.key === "Backspace" && atStart && !inCommands()) {
        const s = boxSearch()
        if (s.sort === "best" && !s.kinds.length && s.scope === "root") return
        e.preventDefault()
        updateSearch({ ...widen(s), query: boxInput.value })
        renderBox()
    }
})
// The menu and tags work by mouse without taking focus from the box.
boxMenu.addEventListener("mousedown", (e) => e.preventDefault())
boxMenu.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>("[data-index]")
    if (item) runMenu(Number(item.dataset.index))
})
boxTags.addEventListener("mousedown", (e) => e.preventDefault())
boxTags.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-remove]")
    if (!t) return
    const s = { ...boxSearch(), query: boxInput.value, at: 0 }
    const what = t.dataset.remove!
    if (what === "scope") s.scope = "root"
    else if (what === "sort") s.sort = "best"
    else s.kinds = s.kinds.filter((k) => `kind:${k}` !== what)
    updateSearch(s)
    renderBox()
})
box.addEventListener("mousedown", (e) => {
    if (e.target === box.querySelector(".omnibox__field")) {
        e.preventDefault()
        boxInput.focus()
    }
})

// --- Start ---

const start = decodeURIComponent(location.hash.slice(1))
const fallback =
    [...nodes.values()].find(
        (n) =>
            n.title === "What was the death toll from Chernobyl and Fukushima?"
    )?.id ?? "root"
// Blocks and title rows exist once their document loads.
const startId = nodes.has(start) || docOf(start) ? start : fallback
const startDoc = docOf(startId)
if (startDoc) await loadDoc(startDoc)
state = { path: ancestry(nodes.has(startId) ? startId : fallback), peek: null }
trail.push({ at: state, via: "walk" })
render(state)
strip.focus()

// A module, so the Location type above stays ours and never merges with the
// browser's global Location.
export {}
