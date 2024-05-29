import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction, toJS } from "mobx"
import * as lodash from "lodash"
import { Redirect } from "react-router-dom"
import { AdminLayout } from "./AdminLayout.js"
import { Modal, TextField } from "./Forms.js"
import { TagGraphNode, TagGraphRoot } from "@ourworldindata/utils"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    DndContext,
    DragEndEvent,
    closestCorners,
    pointerWithin,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGrip } from "@fortawesome/free-solid-svg-icons"

function Box(props: { id: string; children: React.ReactNode }) {
    const drag = useDraggable({
        id: props.id,
    })
    const { attributes, listeners, transform } = drag
    const dragSetNodeRef = drag.setNodeRef
    const drop = useDroppable({
        id: props.id,
    })
    const isOver = drop.isOver
    const dropSetNodeRef = drop.setNodeRef
    const style = {
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : "unset",
        color: isOver ? "green" : undefined,
    }

    return (
        <div
            className="tag-box"
            id={props.id}
            style={style}
            {...attributes}
            ref={(element: HTMLElement | null) => {
                dragSetNodeRef(element)
                dropSetNodeRef(element)
            }}
        >
            {props.children}
            <button className="tag-box__grip-button" {...listeners}>
                <FontAwesomeIcon icon={faGrip} />
            </button>
        </div>
    )
}

interface TagListItem {
    id: number
    name: string
    parentId: number
    specialType?: string
}

@observer
class AddTagModal extends React.Component<{
    parentId?: number
    onClose: () => void
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable tagName: string = ""
    @observable newTagId?: number

    @computed get tag() {
        if (!this.tagName) return undefined

        return {
            parentId: this.props.parentId,
            name: this.tagName,
        }
    }

    async submit() {
        if (this.tag) {
            const resp = await this.context.admin.requestJSON(
                "/api/tags/new",
                { tag: this.tag },
                "POST"
            )
            if (resp.success) {
                this.newTagId = resp.tagId
            }
        }
    }

    @action.bound onTagName(tagName: string) {
        this.tagName = tagName
    }

    render() {
        return (
            <Modal onClose={this.props.onClose}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void this.submit()
                    }}
                >
                    <div className="modal-header">
                        <h5 className="modal-title">Add category</h5>
                    </div>
                    <div className="modal-body">
                        <TextField
                            label="Category Name"
                            value={this.tagName}
                            onValue={this.onTagName}
                            autofocus
                            required
                        />
                    </div>
                    <div className="modal-footer">
                        <input
                            type="submit"
                            className="btn btn-primary"
                            value="Add tag"
                        />
                    </div>
                </form>
                {this.newTagId !== undefined && (
                    <Redirect to={`/tags/${this.newTagId}`} />
                )}
            </Modal>
        )
    }
}

@observer
export class TagsIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    constructor(props: Readonly<unknown>) {
        super(props)
        this.handleDragEnd = this.handleDragEnd.bind(this)
    }

    @observable isAddingTag: boolean = false
    @observable tagGraph: TagGraphRoot | null = null
    @observable addTagParentId?: number

    @action.bound onNewTag(parentId?: number) {
        this.addTagParentId = parentId
        this.isAddingTag = true
    }

    @action.bound handleDragEnd(event: DragEndEvent) {
        if (!this.tagGraph) return

        // "node-1-2-3" -> [2, 3]
        // the first ID is always the root node, so we drop it
        function getPathWithoutRootNode(elementId?: string): number[] {
            if (!elementId) return []
            return elementId.split("-").slice(2).map(Number)
        }

        function getNode(path: number[], node: TagGraphNode) {
            if (path.length === 0) return node
            const child = node.children.find((c) => c.id === path[0])
            if (!child) return null
            return getNode(path.slice(1), child)
        }

        function insertChildAndSort(
            children: TagGraphNode[],
            newNode: TagGraphNode
        ): TagGraphNode[] {
            return [...children, newNode].sort((a, b) => {
                // sort by weight, then by name
                return a.weight - b.weight || a.name.localeCompare(b.name)
            })
        }

        function updatePath(node: TagGraphNode, path: number[]) {
            node.path = [...path, node.id]
            node.children.forEach((child) => updatePath(child, node.path))
        }

        const sourcePath = getPathWithoutRootNode(event.active.id as string)
        const targetPath = getPathWithoutRootNode(event.over?.id as string)
        if (!sourcePath || !targetPath) return

        const isNoop = lodash.isEqual(sourcePath, targetPath)
        if (isNoop) return
        const sourceId = sourcePath.at(-1) as number
        const isCycle = targetPath.includes(sourceId)
        if (isCycle) return

        const sourceNode = getNode(sourcePath, this.tagGraph)
        const sourceParent = getNode(sourcePath.slice(0, -1), this.tagGraph)
        const targetNode = getNode(targetPath, this.tagGraph)
        if (!sourceNode || !sourceParent || !targetNode) return

        // Remove the source node from its parent
        sourceParent.children = sourceParent.children.filter(
            (c) => c.id !== sourceNode.id
        )
        // Update the source node's children's paths
        updatePath(sourceNode, targetNode.path)
        // Add the source node to the target node
        targetNode.children = insertChildAndSort(targetNode.children, {
            ...sourceNode,
            // here we need the full path again, not the one with the root ID stripped out
            path: [...targetNode.path, sourceNode.id],
        })
    }

    render() {
        const renderTagGraphNode = (
            props: TagGraphNode & {
                parentId: number
            }
        ) => {
            return (
                <Box key={props.id} id={`node-${props.path.join("-")}`}>
                    <span>{props.name}</span>
                    {props.children.map((node) =>
                        renderTagGraphNode({
                            ...node,
                            parentId: props.id,
                        })
                    )}
                </Box>
            )
        }
        return (
            <AdminLayout title="Categories">
                <main className="TagsIndexPage">
                    <h2>Tag Graph</h2>
                    <DndContext
                        onDragEnd={this.handleDragEnd}
                        collisionDetection={pointerWithin}
                    >
                        {this.tagGraph &&
                            renderTagGraphNode({
                                ...this.tagGraph,
                                parentId: this.tagGraph.id,
                            })}
                    </DndContext>
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const tagGraph =
            await this.context.admin.getJSON<TagGraphRoot>("/api/tagGraph.json")
        runInAction(() => {
            this.tagGraph = tagGraph
        })
    }

    componentDidMount() {
        void this.getData()
    }
}
