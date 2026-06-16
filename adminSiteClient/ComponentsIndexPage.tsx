import { Component, useState } from "react"
import { observer } from "mobx-react"
import { observable, action, computed, runInAction, makeObservable } from "mobx"
import Markdown, { type Components as MarkdownComponents } from "react-markdown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCopy,
    faCheck,
    faArrowLeft,
    faPenToSquare,
    faCode,
} from "@fortawesome/free-solid-svg-icons"
import { ComponentDoc } from "@ourworldindata/types"
import { AdminLayout } from "./AdminLayout.js"
import { SearchField } from "./Forms.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

// Component docs live as .md sidecars in the repo, gated by CI; the detail view
// links technical editors to the GitHub web editor to propose changes.
const GITHUB_REPO = "https://github.com/owid/owid-grapher"
const githubEditUrl = (sidecarFile: string): string =>
    `${GITHUB_REPO}/edit/master/${sidecarFile}`
const githubBlobUrl = (sourceFile: string): string =>
    `${GITHUB_REPO}/blob/master/${sourceFile}`

// First paragraph of the markdown body, used as the card description.
function describeComponent(doc: ComponentDoc): string {
    const firstParagraph = doc.body.split("\n\n")[0] ?? ""
    return firstParagraph.replace(/\s+/g, " ").trim()
}

function matchesSearch(doc: ComponentDoc, query: string): boolean {
    const haystack = [doc.title, doc.id, doc.typeName, doc.body]
        .join("\n")
        .toLowerCase()
    return haystack.includes(query)
}

// A fenced code block in the rendered markdown body, with a Copy button. The
// fenced blocks are the paste-ready ArchieML examples; this is also the seam
// where a future phase can render the live component instead of its source.
function CopyableCodeBlock({ code }: { code: string }): React.ReactElement {
    const [copied, setCopied] = useState(false)
    const onCopy = (): void => {
        void navigator.clipboard.writeText(code).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }
    return (
        <div className="components-index-page__code">
            <button
                className="components-index-page__copy-button"
                type="button"
                onClick={onCopy}
            >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} />{" "}
                {copied ? "Copied" : "Copy"}
            </button>
            <pre>
                <code>{code}</code>
            </pre>
        </div>
    )
}

// react-markdown passes the <code> element as the <pre>'s child; pull its text
// out so we can attach a Copy button to each example.
function extractCodeText(children: React.ReactNode): string {
    const codeElement = children as
        | React.ReactElement<{ children?: React.ReactNode }>
        | undefined
    const codeChildren = codeElement?.props?.children
    return typeof codeChildren === "string"
        ? codeChildren.replace(/\n$/, "")
        : ""
}

const markdownComponents: MarkdownComponents = {
    pre: ({ children }) => (
        <CopyableCodeBlock code={extractCodeText(children)} />
    ),
}

@observer
export class ComponentsIndexPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    components: ComponentDoc[] = []
    searchInput: string = ""
    selectedId: string | undefined = undefined

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this, {
            components: observable,
            searchInput: observable,
            selectedId: observable,
        })
    }

    @computed get filteredComponents(): ComponentDoc[] {
        const query = this.searchInput.trim().toLowerCase()
        if (!query) return this.components
        return this.components.filter((doc) => matchesSearch(doc, query))
    }

    @computed get selectedComponent(): ComponentDoc | undefined {
        return this.components.find((doc) => doc.id === this.selectedId)
    }

    @action.bound private selectComponent(id: string): void {
        this.selectedId = id
        window.location.hash = id
    }

    @action.bound private clearSelection(): void {
        this.selectedId = undefined
        window.location.hash = ""
    }

    @action.bound private onSearch(value: string): void {
        this.searchInput = value
    }

    private renderCard(doc: ComponentDoc): React.ReactElement {
        return (
            <button
                key={doc.id}
                className="components-index-page__card"
                type="button"
                onClick={() => this.selectComponent(doc.id)}
            >
                <div className="components-index-page__card-title">
                    {doc.title}
                </div>
                <code className="components-index-page__card-id">
                    {`{.${doc.id}}`}
                </code>
                <div className="components-index-page__card-type">
                    {doc.typeName}
                </div>
                <p className="components-index-page__card-description">
                    {describeComponent(doc)}
                </p>
            </button>
        )
    }

    private renderGallery(): React.ReactElement {
        const { filteredComponents, components } = this
        return (
            <>
                <div className="components-index-page__header">
                    <div>
                        <h1 className="components-index-page__heading">
                            ArchieML components
                        </h1>
                        <div className="components-index-page__count">
                            {filteredComponents.length === components.length
                                ? `${components.length} components`
                                : `${filteredComponents.length} of ${components.length} components`}
                        </div>
                    </div>
                    <SearchField
                        placeholder="Search by name, id, type, or description"
                        value={this.searchInput}
                        onValue={this.onSearch}
                        autofocus
                    />
                </div>
                <div className="components-index-page__gallery">
                    {filteredComponents.map((doc) => this.renderCard(doc))}
                </div>
            </>
        )
    }

    private renderDetail(doc: ComponentDoc): React.ReactElement {
        const hasExamples = doc.examples.length > 0
        return (
            <div className="components-index-page__detail" id={doc.id}>
                <button
                    className="components-index-page__back"
                    type="button"
                    onClick={this.clearSelection}
                >
                    <FontAwesomeIcon icon={faArrowLeft} /> All components
                </button>
                <h1 className="components-index-page__detail-title">
                    {doc.title}
                </h1>
                <code className="components-index-page__detail-id">
                    {`{.${doc.id}}`}
                </code>
                <div className="components-index-page__detail-type">
                    {doc.typeName}
                </div>
                <div className="components-index-page__detail-links">
                    <a
                        href={githubEditUrl(doc.sidecarFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faPenToSquare} /> Suggest an edit
                    </a>
                    <a
                        href={githubBlobUrl(doc.sourceFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faCode} /> View type definition
                    </a>
                </div>
                <div className="components-index-page__body">
                    <Markdown components={markdownComponents}>
                        {doc.body}
                    </Markdown>
                </div>
                {!hasExamples && (
                    <p className="components-index-page__empty">
                        This component has no standalone ArchieML example — it
                        only appears nested inside other components.
                    </p>
                )}
            </div>
        )
    }

    override render(): React.ReactElement {
        const { selectedComponent } = this
        return (
            <AdminLayout title="Components">
                <main className="components-index-page">
                    {selectedComponent
                        ? this.renderDetail(selectedComponent)
                        : this.renderGallery()}
                </main>
            </AdminLayout>
        )
    }

    async getData(): Promise<void> {
        const { components } = await this.context.admin.getJSON<{
            components: ComponentDoc[]
        }>("/api/components.json")
        runInAction(() => {
            this.components = components
            const hash = window.location.hash.replace(/^#/, "")
            if (hash && components.some((doc) => doc.id === hash))
                this.selectedId = hash
        })
    }

    override componentDidMount(): void {
        void this.getData()
    }
}
