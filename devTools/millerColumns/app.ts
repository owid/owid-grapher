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
    alias: "From another topic",
    area: "Area",
    topic: "Topic",
    article: "Article",
    "data-insight": "Data insight",
    "topic-page": "Topic page",
    "linear-topic-page": "Topic page",
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
// How a folded group's row names what it holds.
const GROUP_NOUN: Record<string, string> = {
    Articles: "articles",
    "Data insights": "data insights",
    Data: "charts and collections",
    "From other topics": "from other topics",
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
    alias: "From other topics",
}

// --- Data ---

const site = (await fetch("/data/site.json").then((r) => r.json())) as {
    nodes: Record<string, TreeNode>
    references: Record<string, Reference[]>
}
const nodes = new Map(Object.entries(site.nodes))
const references = site.references

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

// A topic's content groups with more than 5 items fold into one row each,
// so a topic column stays short. Subtopics and the overview never fold:
// they are the topic's own structure.
const FOLD_OVER = 5
for (const topic of [...nodes.values()]) {
    if (topic.kind !== "topic" && topic.kind !== "area") continue
    const byGroup = new Map<string, string[]>()
    for (const id of topic.children ?? []) {
        const group = GROUP_OF[nodes.get(id)!.kind]
        if (!group || group === "Topics" || group === "Overview") continue
        if (!byGroup.has(group)) byGroup.set(group, [])
        byGroup.get(group)!.push(id)
    }
    for (const [group, ids] of byGroup) {
        if (ids.length <= FOLD_OVER) continue
        const groupId = `group:${topic.id}:${group}`
        nodes.set(groupId, {
            id: groupId,
            kind: "group",
            title: group,
            parent: topic.id,
            children: ids,
        })
        for (const id of ids) nodes.get(id)!.parent = groupId
        const at = topic.children!.indexOf(ids[0])
        topic.children = topic.children!.filter((id) => !ids.includes(id))
        topic.children.splice(at, 0, groupId)
    }
}
// Where a node is filed, skipping the group rows it may be folded into.
function homeOf(id: string): TreeNode | undefined {
    let at = nodes.get(id)?.parent
    while (at && nodes.get(at)!.kind === "group") at = nodes.get(at)!.parent
    return at ? nodes.get(at) : undefined
}

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
}
let state: Location = { path: ["root"], peek: null }
let landedOn: string | null = null // briefly highlights a jump's destination

const selected = (): string => state.path[state.path.length - 1]

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
    // A folded group ("26 articles") is part of its topic, not a place.
    const holders = loc.path
        .slice(0, -1)
        .filter((id) => node(id).kind !== "group")
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
        return references[n.target!]
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
    if (references[id] && !hasChildren(id))
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
    if (referencesOpen && references[id])
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
    const doc = docOf(next.path[next.path.length - 1])
    if (doc) await loadDoc(doc)
    if (!opts.fromHistory) {
        if (opts.jump || placeOf(next) !== placeOf(state)) {
            trail.splice(stopIndex + 1)
            trail.push({ at: next, via: opts.jump ? "jump" : "walk" })
            stopIndex = trail.length - 1
        } else trail[stopIndex] = { ...trail[stopIndex], at: next }
    }
    if (next.path.join() !== state.path.join()) referencesOpen = false
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
    await go({ path, peek: null }, { jump: true })
}

// --- Keyboard ---

function siblingsOf(id: string): string[] {
    const parent = node(id).parent
    return parent ? childrenOf(parent) : [id]
}
async function move(delta: number): Promise<void> {
    const peek = state.peek
    if (peek) {
        const plan = activePeek()!
        const count =
            peek.zone === "links" && plan.kind === "links"
                ? plan.links.length
                : 1 +
                  (references[targetOfPeek(plan, peek)?.target ?? ""]?.length ??
                      0)
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
    if (state.path.length > 2)
        await go({ path: state.path.slice(0, -1), peek: null })
}
async function enter(): Promise<void> {
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
    else await jumpTo(references[link.target][peek.row - 1].from)
}
async function goToStop(i: number): Promise<void> {
    if (i < 0 || i >= trail.length || i === stopIndex) return
    stopIndex = i
    await go(trail[i].at, { fromHistory: true })
}
const back = (): Promise<void> => goToStop(stopIndex - 1)
const forward = (): Promise<void> => goToStop(stopIndex + 1)

document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        return void openPalette()
    }
    if (palette.open) return
    if (e.metaKey && e.key === "[") return void back()
    if (e.metaKey && e.key === "]") return void forward()
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const handlers: Record<string, () => Promise<void> | void> = {
        ArrowUp: () => move(-1),
        ArrowDown: () => move(1),
        ArrowRight: right,
        ArrowLeft: left,
        Enter: enter,
        Backspace: () => (e.shiftKey ? forward() : back()),
        Escape: () => go({ ...state, peek: null }),
        Home: () => move(-1e6),
        End: () => move(1e6),
        r: () => {
            if (!references[selected()]) return
            referencesOpen = !referencesOpen
            state = { ...state, peek: null }
            render(state)
        },
    }
    const handler = handlers[e.key]
    if (!handler) return
    e.preventDefault()
    document.body.classList.add("is-keying")
    // Keys typed while a document loads apply in order, after it lands.
    keyQueue = keyQueue.then(handler).catch(console.error)
})
let keyQueue: Promise<void> = Promise.resolve()
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
        place: "M3 3h10v10H3zM3 7h10",
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
    const parts = [KIND_LABEL[n.kind]]
    if (n.date) parts.push(n.date.slice(0, 4))
    if (n.kind === "mdm" || n.kind === "dimension")
        parts.push(`${countLeaves(n.id)} views`)
    if (n.kind === "area" || n.kind === "topic")
        parts.push(
            `${childrenOf(n.id).reduce(
                (sum, k) =>
                    sum + (node(k).kind === "group" ? childrenOf(k).length : 1),
                0
            )}`
        )
    return parts.filter(Boolean).join(" · ")
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
        case "group":
            row.append(
                el(
                    "span",
                    "row__text",
                    el(
                        "span",
                        "row__title",
                        `${childrenOf(id).length} ${GROUP_NOUN[n.title] ?? "items"}`
                    )
                )
            )
            trailing.append(icon("chevron"))
            break
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
            row.append(
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", n.title),
                    el("span", "row__meta", metaLine(n))
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
    for (const id of childrenOf(parentId)) {
        const kind = node(id).kind
        // A folded group sits under its own header; inside it, the column
        // itself is the group.
        const g =
            node(id).dimension ??
            (kind === "group" ? node(id).title : GROUP_OF[kind])
        if (!prose && g && g !== group && parent.kind !== "group") {
            list.append(el("div", "group-label", g))
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
                el(
                    "span",
                    "row__text",
                    el("span", "row__title", target.title),
                    el(
                        "span",
                        "row__meta",
                        icon("jump"),
                        KIND_LABEL[target.kind] ?? target.kind,
                        home ? ` · in ${home.title}` : ""
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
    col.append(
        el(
            "header",
            "peek__header",
            icon("here"),
            // One wording for the whole panel: what the item is, then where
            // it lives, then where it's used.
            `${isSelf ? "This" : "Linked"} ${kindName(target.kind)}`
        )
    )
    const body = el("div", "col__body")

    // Definition: the one canonical place.
    const def = el(
        "div",
        `row row--definition ${row === 0 ? "is-selected" : ""}`
    )
    def.dataset.peekRow = "0"
    const trail = ancestry(link.target).slice(1)
    const path = el("ol", "def-path")
    trail.forEach((a, i) =>
        path.append(
            el(
                "li",
                i === trail.length - 1 ? "def-path__here" : "",
                node(a).title
            )
        )
    )
    if (target.thumb) def.append(thumb(target.thumb, "def__thumb"))
    def.append(el("div", "def__label", isHome ? "You are here" : "Lives in"))
    def.append(path)
    if (!isHome) def.append(el("div", "def__action", "⏎ Go there"))
    body.append(def)

    // References: every block that links to or embeds the target.
    const refs = references[link.target] ?? []
    body.append(
        el(
            "div",
            "group-label",
            refs.length
                ? `Used in ${refs.length} place${refs.length === 1 ? "" : "s"}`
                : "Not used anywhere"
        )
    )
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
    const shown = state.path.slice(1).filter((id) => node(id).kind !== "title")
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
    const also = node(selected()).alsoIn
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

const stopTitle = (stop: Stop): string => node(placeOf(stop.at)).title

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
    const plan = activePeek()
    const hints: [string, string][] = [
        ["↑ ↓", state.peek ? "Move in the side panel" : "Previous / next"],
    ]
    if (state.peek) {
        hints.push(["←", "Back to the tree"])
        const external = !targetOfPeek(plan, state.peek)?.target
        hints.push(["⏎", external ? "Open in a new tab" : "Jump there"])
    } else {
        if (hasChildren(selected()) && !referencesOpen)
            hints.push(["→ ⏎", "Open"])
        else if (plan)
            hints.push([
                "→ ⏎",
                plan.kind === "links"
                    ? "Look at its links"
                    : "Look at its references",
            ])
        if (state.path.length > 2) hints.push(["←", "Up a level"])
        if (references[selected()] && hasChildren(selected()))
            hints.push(["R", referencesOpen ? "Hide references" : "References"])
    }
    if (stopIndex > 0) hints.push(["⌫", "Back"])
    hints.push(["⌘K", "Search and actions"])
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
    const ancestors = cols.slice(0, -1)
    for (const c of ancestors) {
        if (fits()) break
        c.classList.add("is-folded")
    }
    // Still too wide: keep only the nearest folded level. The breadcrumb
    // above names the rest.
    if (!fits())
        ancestors.slice(0, -1).forEach((c) => c.classList.add("is-hidden"))
    keepTrailInView()
    // Columns never shrink: when they don't all fit, the view follows the
    // focus. Reading keeps the column whole; stepping into the side panel
    // slides it fully into view.
    const origin = strip.getBoundingClientRect().left - strip.scrollLeft
    const rightOf = (e: Element): number =>
        e.getBoundingClientRect().right - origin
    const dock = trailing.querySelector<HTMLElement>(".peek-dock")
    const focusRight =
        state.peek && dock ? rightOf(dock) + 12 : rightOf(cols[cols.length - 1])
    strip.scrollLeft = Math.max(0, focusRight - available)
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

    const cols: HTMLElement[] = []
    // Whatever sits right of the selection (a preview, the side panel, or
    // nothing) goes in one fixed-width slot, so it never moves the columns.
    const trailing = el("div", "trailing")
    const p = state.path
    for (let i = 0; i < p.length; i++) {
        const parentId = p[i]
        const selectedId = p[i + 1]
        if (!selectedId && !hasChildren(parentId)) break
        if (!selectedId && referencesOpen) break
        const isTrail = i < p.length - 2 || state.peek !== null
        const col = treeColumn(parentId, selectedId, i, isTrail)
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
    const peekCols = peekColumns()
    if (peekCols.length) {
        const dock = el("div", "peek-dock", ...peekCols)
        if (state.peek) dock.classList.add("is-active")
        if (!hadDock) dock.classList.add("is-entering")
        trailing.append(dock)
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
    renderCrumbs()
    renderKeys()
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

// --- Mouse ---

strip.addEventListener("click", (e) => {
    const t = e.target as HTMLElement
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
    if (e.detail > 1 && node(id).kind === "alias")
        return void jumpTo(node(id).target!)
    void go({ path, peek: null })
})
crumbs.addEventListener("click", (e) => {
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

// --- Command palette ---

// ⌘K opens one box for doing and finding. Empty, it offers what you can do
// with the selection, then recent places. Typing filters those, then adds
// sections of the open document and matching places from the whole site.
interface Command {
    label: string
    detail?: string
    icon: string
    keys?: string
    run: () => void | Promise<void>
}
const palette = document.querySelector<HTMLDialogElement>(".palette")!
const paletteInput = palette.querySelector<HTMLInputElement>("input")!
const paletteList = palette.querySelector<HTMLElement>(".palette__list")!
let paletteGroups: { title: string; commands: Command[] }[] = []
let paletteActive = 0

const SEARCHABLE: Record<string, number> = {
    // Lower ranks first among equally good matches.
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
const searchIndex = [...nodes.values()]
    .filter((n) => n.kind in SEARCHABLE)
    .map((n) => ({ id: n.id, title: n.title.toLowerCase() }))

const matches = (text: string, words: string[]): boolean =>
    words.every((w) => text.toLowerCase().includes(w))

function placeCommand(id: string): Command {
    const n = node(id)
    const home = homeOf(id)
    return {
        label: n.title,
        detail: [KIND_LABEL[n.kind], home?.title].filter(Boolean).join(" · "),
        icon: "place",
        run: () => jumpTo(id),
    }
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
    const id = selected()
    const n = node(id)
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
            run: showReferences,
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
    if (state.path.length > 2) {
        const parent = node(state.path[state.path.length - 2])
        // A folded group is named the way its row reads.
        const name =
            parent.kind === "group"
                ? `${childrenOf(parent.id).length} ${GROUP_NOUN[parent.title]}`
                : parent.title
        out.push({
            label: `Up to ${name}`,
            icon: "up",
            keys: "←",
            run: () => go({ path: state.path.slice(0, -1), peek: null }),
        })
    }
    out.push({
        label: "Copy link to this place",
        icon: "copy",
        run: () => navigator.clipboard.writeText(location.href),
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
    const here = placeOf(state)
    const seen = new Set([here])
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

// Headings of the document you're in, like VS Code's "go to symbol".
function sectionCommands(words: string[]): Command[] {
    const doc = docOf(selected())
    if (!doc) return []
    const out: Command[] = []
    const walk = (id: string): void => {
        for (const k of childrenOf(id)) {
            const kid = node(k)
            if (kid.kind !== "heading") continue
            if (matches(kid.title, words))
                out.push({
                    label: kid.title,
                    icon: "section",
                    run: () => go({ path: ancestry(k), peek: null }),
                })
            walk(k)
        }
    }
    walk(doc)
    return out
}

function searchCommands(query: string, words: string[]): Command[] {
    const scored: { id: string; score: number }[] = []
    for (const entry of searchIndex) {
        if (!words.every((w) => entry.title.includes(w))) continue
        const at = entry.title.indexOf(query)
        // Whole query at the start, then at a word start, then anywhere.
        const quality =
            at === 0 ? 0 : at > 0 && entry.title[at - 1] === " " ? 1 : 2
        const kind = SEARCHABLE[node(entry.id).kind]
        scored.push({
            id: entry.id,
            score: quality * 100 + kind * 10 + entry.title.length / 100,
        })
    }
    return scored
        .sort((a, b) => a.score - b.score)
        .slice(0, 40)
        .map((s) => placeCommand(s.id))
}

function selectionNoun(): string {
    const n = node(selected())
    const kind = n.kind === "title" ? node(n.target!).kind : n.kind
    return kindName(kind === "group" ? "group" : kind)
}

function updatePalette(): void {
    const query = paletteInput.value.trim().toLowerCase()
    const words = query.split(/\s+/).filter(Boolean)
    const actions = [
        {
            title: `This ${selectionNoun()}`,
            commands: selectionCommands().filter((c) =>
                matches(c.label, words)
            ),
        },
        {
            title: "History",
            commands: historyCommands().filter((c) => matches(c.label, words)),
        },
    ]
    const doc = docOf(selected())
    // Typing is searching: places come first, so Enter opens the best match.
    paletteGroups = [
        ...(words.length
            ? [
                  {
                      title: doc ? `In “${node(doc).title}”` : "",
                      commands: sectionCommands(words),
                  },
                  {
                      title: "Everywhere",
                      commands: searchCommands(query, words),
                  },
                  ...actions,
              ]
            : [
                  ...actions,
                  { title: "Recent places", commands: recentCommands() },
              ]),
    ].filter((g) => g.commands.length)
    paletteActive = 0
    renderPalette()
}

function renderPalette(): void {
    paletteList.replaceChildren()
    let index = 0
    for (const g of paletteGroups) {
        const group = el("div", "palette__group")
        group.setAttribute("role", "group")
        group.append(el("div", "palette__group-label", g.title))
        for (const c of g.commands) {
            const item = el(
                "div",
                `palette__item ${index === paletteActive ? "is-active" : ""}`,
                icon(c.icon),
                el("span", "palette__label", c.label),
                c.detail ? el("span", "palette__detail", c.detail) : null,
                c.keys ? el("kbd", "", c.keys) : null
            )
            item.setAttribute("role", "option")
            item.setAttribute("aria-selected", String(index === paletteActive))
            item.dataset.index = String(index++)
            group.append(item)
        }
        paletteList.append(group)
    }
    if (!index)
        paletteList.append(
            el("p", "palette__empty", "Nothing matches. Try fewer words.")
        )
    paletteList
        .querySelector(".is-active")
        ?.scrollIntoView({ block: "nearest" })
}

const paletteCommands = (): Command[] =>
    paletteGroups.flatMap((g) => g.commands)
function runPaletteCommand(i: number): void {
    const command = paletteCommands()[i]
    if (!command) return
    palette.close()
    keyQueue = keyQueue.then(command.run).catch(console.error)
}
async function openPalette(): Promise<void> {
    if (palette.open) return void paletteInput.select()
    // Sections come from the open document's body.
    const doc = docOf(selected())
    if (doc) await loadDoc(doc)
    paletteInput.value = ""
    updatePalette()
    palette.showModal()
}

paletteInput.addEventListener("input", updatePalette)
paletteInput.addEventListener("keydown", (e) => {
    // Enter closes the palette; the page must not then see it too.
    e.stopPropagation()
    const count = paletteCommands().length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const delta = e.key === "ArrowDown" ? 1 : -1
        paletteActive = (paletteActive + delta + count) % Math.max(count, 1)
        renderPalette()
    } else if (e.key === "Enter") {
        e.preventDefault()
        runPaletteCommand(paletteActive)
    }
})
paletteList.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>("[data-index]")
    if (item) runPaletteCommand(Number(item.dataset.index))
})
// A click on the backdrop lands on the dialog itself.
palette.addEventListener("click", (e) => {
    if (e.target === palette) palette.close()
})
palette.addEventListener("close", () => strip.focus())
document
    .querySelector('[data-action="palette"]')!
    .addEventListener("click", () => void openPalette())

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
