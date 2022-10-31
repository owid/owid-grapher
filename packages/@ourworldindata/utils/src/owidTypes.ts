import { Tag as TagReactTagAutocomplete } from "react-tag-autocomplete"

// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

/** The "plot" is a chart without any header, footer or controls */
export const IDEAL_PLOT_ASPECT_RATIO: number = 1.8

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export type Integer = number
// TODO: remove duplicate definition, also available in CoreTable
export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export enum SortBy {
    custom = "custom",
    entityName = "entityName",
    column = "column",
    total = "total",
}

export interface SortConfig {
    sortBy?: SortBy
    sortOrder?: SortOrder
    sortColumnSlug?: string
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]

export type PrimitiveType = number | string | boolean
export type ValueRange = [number, number]

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface RelatedChart {
    title: string
    slug: string
    variantName?: string | null
    isKey?: boolean
}

export type OwidVariableId = Integer // remove.

export const BLOCK_WRAPPER_DATATYPE = "block-wrapper"

export interface FormattedPost extends FullPost {
    supertitle?: string
    stickyNavLinks?: { text: string; target: string }[]
    lastUpdated?: string
    byline?: string
    info?: string
    html: string
    style?: string
    footnotes: string[]
    tocHeadings: TocHeading[]
    pageDesc: string
}

export enum SubNavId {
    about = "about",
    biodiversity = "biodiversity",
    coronavirus = "coronavirus",
    co2 = "co2",
    energy = "energy",
    forests = "forests",
    water = "water",
    explorers = "explorers",
}

export interface FormattingOptions {
    toc?: boolean
    hideAuthors?: boolean
    bodyClassName?: string
    subnavId?: SubNavId
    subnavCurrentId?: string
    raw?: boolean
    hideDonateFooter?: boolean
    footnotes?: boolean
}

export interface KeyValueProps {
    [key: string]: string | boolean | undefined
}

export interface DataValueQueryArgs {
    variableId?: number
    entityId?: number
    chartId?: number
    year?: number
}

export interface DataValueConfiguration {
    queryArgs: DataValueQueryArgs
    template: string
}

export interface DataValueResult {
    value: number
    year: number
    unit?: string
    entityName: string
}

export interface DataValueProps extends DataValueResult {
    formattedValue?: string
    template: string
}

export interface GitCommit {
    author_email: string
    author_name: string
    body: string
    date: string
    hash: string
    message: string
}

export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}

export interface TocHeading {
    text: string
    html?: string // used by SectionHeading toc. Excluded from LongFormPage toc.
    slug: string
    isSubheading: boolean
}

// todo; remove
export interface PostRow {
    id: number
    title: string
    slug: string
    type: WP_PostType
    status: string
    content: string
    published_at: Date | null
    updated_at: Date
    archieml: string
    archieml_update_statistics: string
}

export interface Tag extends TagReactTagAutocomplete {
    isKey?: boolean
}

export interface EntryMeta {
    slug: string
    title: string
    excerpt: string
    kpi: string
}

export interface CategoryWithEntries {
    name: string
    slug: string
    entries: EntryMeta[]
    subcategories: CategoryWithEntries[]
}

export enum WP_PostType {
    Post = "post",
    Page = "page",
}

export interface EntryNode {
    slug: string
    title: string
    // in some edge cases (entry alone in a subcategory), WPGraphQL returns
    // null instead of an empty string)
    excerpt: string | null
    kpi: string
}

export type TopicId = number

export enum GraphDocumentType {
    Topic = "topic",
    Article = "article",
}

export interface AlgoliaRecord {
    id: number
    title: string
    type: GraphType | GraphDocumentType
    image?: string
}

export interface DocumentNode {
    id: number
    title: string
    slug: string
    content: string | null // if content is empty
    type: GraphDocumentType
    image: string | null
    parentTopics: Array<TopicId>
}

export interface CategoryNode {
    name: string
    slug: string
    pages: any
    children: any
}

export enum GraphType {
    Document = "document",
    Chart = "chart",
}

export interface ChartRecord {
    id: number
    title: string
    slug: string
    type: GraphType.Chart
    parentTopics: Array<TopicId>
}

export interface PostReference {
    id: number
    title: string
    slug: string
}

export type FilterFnPostRestApi = (post: PostRestApi) => boolean

export interface PostRestApi {
    slug: string
    meta: {
        owid_publication_context_meta_field?: {
            immediate_newsletter?: boolean
            homepage?: boolean
            latest?: boolean
        }
    }
}

export interface KeyInsight {
    title: string
    isTitleHidden?: boolean
    content: string
    slug: string
}

export interface IndexPost {
    title: string
    slug: string
    date: Date
    authors: string[]
    excerpt?: string
    imageUrl?: string
}

export interface FullPost extends IndexPost {
    id: number
    type: WP_PostType
    path: string
    modifiedDate: Date
    content: string
    thumbnailUrl?: string
    imageId?: number
    postId?: number
    relatedCharts?: RelatedChart[]
    glossary: boolean
}

export enum WP_ColumnStyle {
    StickyRight = "sticky-right",
    StickyLeft = "sticky-left",
    SideBySide = "side-by-side",
}

export enum WP_BlockClass {
    FullContentWidth = "wp-block-full-content-width", // not an actual WP block yet
}

export enum WP_BlockType {
    AllCharts = "all-charts",
}

export enum SuggestedChartRevisionStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected",
    flagged = "flagged",
}

// Exception format that can be easily given as an API error
export class JsonError extends Error {
    status: number
    constructor(message: string, status?: number) {
        super(message)
        this.status = status || 400
    }
}

export enum DeployStatus {
    queued = "queued",
    pending = "pending",
    // done = "done"
}

export interface DeployChange {
    timeISOString?: string
    authorName?: string
    authorEmail?: string
    message?: string
    slug?: string
}

export interface Deploy {
    status: DeployStatus
    changes: DeployChange[]
}

export interface Annotation {
    entityName?: string
    year?: number
}

export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

// see CoreTableConstants.ts
export type ColumnSlug = string // a url friendly name for a column in a table. cannot have spaces

export enum Position {
    top = "top",
    right = "right",
    bottom = "bottom",
    left = "left",
}

export type PositionMap<Value> = {
    [key in Position]?: Value
}

export enum HorizontalAlign {
    left = "left",
    center = "center",
    right = "right",
}

export enum VerticalAlign {
    top = "top",
    middle = "middle",
    bottom = "bottom",
}

export enum AxisAlign {
    start = "start",
    middle = "middle",
    end = "end",
}

export interface GridParameters {
    rows: number
    columns: number
}

export interface SpanText {
    type: "span-text"
    text: string
}
export interface SpanFallback {
    type: "span-fallback"
    children: Span[]
}

export interface SpanLink {
    type: "span-link"
    children: Span[]
    url: string
}
export interface SpanNewline {
    type: "span-newline"
}
export interface SpanItalic {
    type: "span-italic"
    children: Span[]
}
export interface SpanBold {
    type: "span-bold"
    children: Span[]
}
export interface SpanUnderline {
    type: "span-underline"
    children: Span[]
}
export interface SpanSubscript {
    type: "span-subscript"
    children: Span[]
}
export interface SpanSuperscript {
    type: "span-superscript"
    children: Span[]
}
export interface SpanQuote {
    type: "span-quote"
    children: Span[]
}

export type Span =
    | SpanText
    | SpanLink
    | SpanNewline
    | SpanItalic
    | SpanBold
    | SpanUnderline
    | SpanSubscript
    | SpanSuperscript
    | SpanQuote
    | SpanFallback

export interface BlockAsideValue {
    position: string
    caption: string
}

export interface BlockAside {
    type: "aside"
    value: BlockAsideValue
}

export interface BlockChartValue {
    url: string
    height?: string
    row: string
    column: string
    // TODO: position is used as a classname apparently? Should be renamed or split
    position?: string
    caption?: string
}
export interface BlockChart {
    type: "chart"
    value: BlockChartValue | string
}

export interface BlockScroller {
    type: "scroller"
    value: OwidArticleBlock[]
}

export interface ChartStorySlide {
    narrative: string
    chart: string
    technical?: string[]
}

export interface ChartStoryValue {
    slides: ChartStorySlide[]
}

export interface BlockChartStory {
    type: "chart-story"
    value: ChartStoryValue
}
export interface BlockFixedGraphic {
    type: "fixed-graphic"
    value: OwidArticleBlock[]
}
export interface BlockImageValue {
    src: string
    caption?: string
}
export interface BlockImage {
    type: "image"
    value: BlockImageValue
}
export interface BlockList {
    type: "list"
    value: string[]
}
export interface BlockPullQuote {
    type: "pull-quote"
    value: string[]
}
export interface RecircItem {
    article: string
    author: string
    url: string
}

export interface BlockRecircValue {
    title: string
    list: RecircItem[]
}
export interface BlockRecirc {
    type: "recirc"
    value: BlockRecircValue[]
}
export interface BlockText {
    type: "text"
    value: string
}

export interface BlockStructuredText {
    type: "structured-text"
    value: Span[]
}
export interface BlockHtml {
    type: "html"
    value: string
}
export interface BlockUrl {
    type: "url"
    value: string
}
export interface BlockPosition {
    type: "position"
    value: string
}

export interface BlockHeaderValue {
    text: string
    level: string
}
export interface BlockHeader {
    type: "header"
    value: BlockHeaderValue
}
export type OwidArticleBlock =
    | BlockAside
    | BlockChart
    | BlockScroller
    | BlockChartStory
    | BlockFixedGraphic
    | BlockImage
    | BlockList
    | BlockPullQuote
    | BlockRecirc
    | BlockText
    | BlockUrl // do we want this here? It's used inside Scroller only atm
    | BlockPosition
    | BlockHeader
    | BlockStructuredText
    | BlockHtml

export interface OwidArticleType {
    id: string
    slug: string
    content: OwidArticleContent
    published: boolean
    createdAt: Date
    publishedAt: Date | null
    updatedAt: Date | null
}

// see also: getArticleFromJSON()
export interface OwidArticleTypeJSON
    extends Omit<OwidArticleType, "createdAt" | "publishedAt" | "updatedAt"> {
    createdAt: string
    publishedAt: string | null
    updatedAt: string | null
}

/**
 * See ../adminSiteClient/gdocsValidation/getErrors() where these existence
 * constraints are surfaced at runtime on the draft article
 */
export interface OwidArticleTypePublished extends OwidArticleType {
    publishedAt: Date
    updatedAt: Date
    content: OwidArticleContentPublished
}

export interface OwidArticleContent {
    body?: OwidArticleBlock[]
    title?: string
    subtitle?: string
    template?: string
    byline?: string | string[]
    dateline?: string
    excerpt?: string
    refs?: OwidArticleBlock[]
    summary?: OwidArticleBlock[]
    citation?: OwidArticleBlock[]
    "cover-image"?: any
    "featured-image"?: any
}

export interface OwidArticleContentPublished extends OwidArticleContent {
    body: OwidArticleBlock[]
    title: string
    byline: string | string[]
    excerpt: string
}

export type GdocsPatch = Partial<OwidArticleType>

export enum GdocsContentSource {
    Internal = "internal",
    Gdocs = "gdocs",
}

export enum SiteFooterContext {
    gdocsPreview = "gdocsPreview", // the previewed version (in the admin)
    gdocsArticle = "gdocsArticle", // the rendered version (on the site)
    grapherPage = "grapherPage",
    explorerPage = "explorerPage",
    default = "default",
}
