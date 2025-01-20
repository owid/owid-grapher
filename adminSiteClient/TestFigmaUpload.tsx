import * as React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { observable, action, computed } from "mobx"
import { observer } from "mobx-react"
import { FIGMA_API_TOKEN } from "../settings/clientSettings.js"

const testFigmaUrl =
    "https://www.figma.com/design/nuswudFJBzVotKWNtkeIQw/Sophia's-playground?node-id=424-96"

class FigmaUploadStore {
    @observable figmaPageUrl: string = testFigmaUrl
    @observable figmaDownloadNodeId: string = ""
    @observable figmaImageUrl: string = ""
    @observable imageBlob: Blob | null = null

    @action
    setFigmaPageUrl(url: string) {
        this.figmaPageUrl = url
    }

    @action
    setFigmaDownloadNodeId(id: string) {
        this.figmaDownloadNodeId = id
    }

    @action setFigmaImageUrl(url: string) {
        this.figmaImageUrl = url
    }

    @action setImageBlob(blob: Blob) {
        this.imageBlob = blob
    }

    private extractFigmaFileIdAndPageId() {
        const regex = /\/design\/([^/]+).*[\?&]node-id=([^&]+)/
        const match = this.figmaPageUrl.match(regex)
        if (match) {
            const [_match, fileId, pageId] = match
            return { fileId, pageId: pageId.replace("-", ":") }
        } else {
            return {}
        }
    }

    @computed get figmaFileId() {
        return this.extractFigmaFileIdAndPageId()?.fileId
    }

    @computed get figmaPageId() {
        return this.extractFigmaFileIdAndPageId()?.pageId
    }

    @computed get figmaPageIdForUrl() {
        return this.figmaPageId?.replace(":", "-")
    }
}

@observer
export class TestFigmaUpload extends React.Component {
    private store: FigmaUploadStore

    constructor(props: {}) {
        super(props)
        this.store = new FigmaUploadStore()
    }

    onSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        // Get the given Figma URL from the form
        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const figmaPageUrl = formData.get("figma-url") as string
        this.store.setFigmaPageUrl(figmaPageUrl)

        const figmaPageResponse = await fetch(
            `https://api.figma.com/v1/files/${this.store.figmaFileId}/nodes?ids=${this.store.figmaPageIdForUrl}&depth=1`,
            {
                method: "GET",
                headers: {
                    "X-Figma-Token": FIGMA_API_TOKEN,
                },
            }
        )
        const figmaPage = await figmaPageResponse.json()
        if (!figmaPage) {
            console.log("Figma page not found")
            return
        }

        const nodeForDownload = figmaPage.nodes[
            this.store.figmaPageId!
        ].document.children.find((node) => node.name === "Chart to upload")

        if (!nodeForDownload) {
            console.log("Node for download not found")
            return
        }

        this.store.setFigmaDownloadNodeId(nodeForDownload.id)
        const nodeResponse = await fetch(
            `https://api.figma.com/v1/images/${this.store.figmaFileId}?ids=${this.store.figmaDownloadNodeId}&scale=4`,
            {
                method: "GET",
                headers: {
                    "X-Figma-Token": FIGMA_API_TOKEN,
                },
            }
        )
        const imagesForNodes = await nodeResponse.json()

        if (!imagesForNodes || imagesForNodes.err !== null) {
            console.log("Images for nodes not found", imagesForNodes)
            return
        }

        const imageUrl = imagesForNodes.images[this.store.figmaDownloadNodeId]
        this.store.setFigmaImageUrl(imageUrl)

        const imageResponse = await fetch(imageUrl)
        const blob = await imageResponse.blob()
        this.store.setImageBlob(blob)
    }

    render() {
        return (
            <AdminLayout title="Data Insight">
                <main className="DataInsightPage">
                    <form onSubmit={this.onSubmit}>
                        <p>
                            <label
                                htmlFor="figma-url"
                                style={{ marginRight: 4 }}
                            >
                                Figma URL:
                            </label>
                            <input
                                type="text"
                                id="figma-url"
                                name="figma-url"
                                value={this.store.figmaPageUrl}
                                onChange={(e) =>
                                    this.store.setFigmaPageUrl(e.target.value)
                                }
                                style={{ width: "100%" }}
                            />
                        </p>
                        <button type="submit">Submit</button>
                    </form>
                    <div style={{ marginTop: "24px" }}>
                        <h4>Debug info</h4>
                        <div>Figma file id: {this.store.figmaFileId}</div>
                        <div>Figma page id: {this.store.figmaPageId}</div>
                        <div>
                            Figma node id: {this.store.figmaDownloadNodeId}
                        </div>
                        <div>Image URL: {this.store.figmaImageUrl}</div>
                        <div>Image blob size: {this.store.imageBlob?.size}</div>
                    </div>
                    {this.store.figmaImageUrl && (
                        <img
                            src={this.store.figmaImageUrl}
                            width="580"
                            height="580"
                        />
                    )}
                </main>
            </AdminLayout>
        )
    }
}
