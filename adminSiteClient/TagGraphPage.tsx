import * as React from "react"
import { observer } from "mobx-react"
import { observable, action, runInAction, toJS, computed } from "mobx"
import * as lodash from "lodash"
import { AdminLayout } from "./AdminLayout.js"
import {
    MinimalTagWithIsTopic,
    TagGraphNode,
    TagGraphRoot,
    createTagGraph,
} from "@ourworldindata/utils"
import { TagBadge } from "./TagBadge.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    DndContext,
    DragEndEvent,
    pointerWithin,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGrip } from "@fortawesome/free-solid-svg-icons"
import { AutoComplete, Button, Popconfirm } from "antd"
import { FlatTagGraph, FlatTagGraphNode } from "@ourworldindata/types"
import { Link } from "react-router-dom"

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
function DraggableDroppable(props: {
    id: string
    children: React.ReactNode
    className?: string
    disableDroppable?: boolean
}) {
    const drag = useDraggable({
        id: props.id,
    })
    const { attributes, listeners, transform } = drag
    const shouldDisableDroppable = !!transform || props.disableDroppable
    const dragSetNodeRef = drag.setNodeRef
    const drop = useDroppable({
        id: props.id,
        disabled: shouldDisableDroppable,
    })
    const isOver = drop.isOver
    const dropSetNodeRef = drop.setNodeRef

    return (
        <div
            {...attributes}
            className={cx(props.className, {
                [`${props.className}--dragging`]: !!transform,
                [`${props.className}--hovering`]: !!isOver,
            })}
            id={props.id}
            style={{
                transform: transform
                    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                    : "unset",
            }}
            ref={(element: HTMLElement | null) => {
                dragSetNodeRef(element)
                dropSetNodeRef(element)
            }}
        >
            {React.Children.map(props.children, (child) => {
                if (React.isValidElement(child)) {
                    if (child.type === TagGraphNodeContainer) {
                        return React.cloneElement(child, {
                            ...child.props,
                            // If this node is being dragged, prevent all its children from being valid drop targets
                            disableDroppable: shouldDisableDroppable,
                        })
                    }
                }
                return child
            })}
            <button className="grip-button" {...listeners}>
                <FontAwesomeIcon icon={faGrip} />
            </button>
        </div>
    )
}

@observer
class AddChildForm extends React.Component<{
    tags: MinimalTagWithIsTopic[]
    label: string
    setChild: (parentId: number, childId: number) => void
    parentId: number
}> {
    @observable isAddingTag: boolean = false
    @observable autocompleteValue: string = ""

    render() {
        if (!this.isAddingTag) {
            return (
                <Button
                    onClick={() => (this.isAddingTag = true)}
                    type="primary"
                    className="add-tag-button"
                >
                    {this.props.label}
                </Button>
            )
        }
        return (
            <form className="add-tag-form">
                <AutoComplete
                    autoFocus
                    className="add-tag-input"
                    value={this.autocompleteValue}
                    onChange={(value) => (this.autocompleteValue = value)}
                    options={this.props.tags.map((tag) => ({
                        value: tag.name,
                        label: tag.name,
                    }))}
                    filterOption={(inputValue, option) => {
                        if (!option?.label) return false
                        return option.label
                            .toLowerCase()
                            .startsWith(inputValue.toLowerCase())
                    }}
                />
                <Button
                    onClick={() => {
                        const tag = this.props.tags.find(
                            (t) => t.name === this.autocompleteValue
                        )
                        if (!tag) return
                        this.props.setChild(this.props.parentId, tag.id)
                        this.isAddingTag = false
                        this.autocompleteValue = ""
                    }}
                    disabled={
                        !this.props.tags
                            .map((t) => t.name)
                            .includes(this.autocompleteValue)
                    }
                >
                    Add
                </Button>
                <Button onClick={() => (this.isAddingTag = false)}>
                    Cancel
                </Button>
            </form>
        )
    }
}

@observer
class TagGraphNodeContainer extends React.Component<{
    node: TagGraphNode
    parentId: number
    setWeight: (parentId: number, childId: number, weight: number) => void
    setChild: (parentId: number, childId: number) => void
    removeNode: (parentId: number, childId: number) => void
    tags: MinimalTagWithIsTopic[]
    parentsById: Record<string, MinimalTagWithIsTopic[]>
    disableDroppable?: boolean
}> {
    constructor(props: any) {
        super(props)
        this.handleUpdateWeight = this.handleUpdateWeight.bind(this)
    }

    handleUpdateWeight(e: React.ChangeEvent<HTMLInputElement>) {
        const weight = Number(e.target.value)
        const parentId = this.props.parentId
        const childId = this.props.node.id
        this.props.setWeight(parentId, childId, weight)
    }

    // Coparents are the other parents of this node
    // e.g.
    //  Health -> Obesity
    //  Food and Agriculture -> Diet -> Obesity
    //  If we're on the Health -> Obesity node, coparents = [Diet]
    @computed get coparents() {
        return (this.props.parentsById[this.props.node.id] || []).filter(
            (tag) => tag.id !== this.props.parentId
        )
    }

    get addableTags() {
        return this.props.tags.filter((tag) => {
            const isDuplicate = tag.id === this.props.node.id
            const isParent = this.props.node.path.includes(tag.id)
            const isChild = this.props.node.children.find(
                (c) => c.name === tag.name
            )
            const isCoparent = this.coparents.find((t) => t.id === tag.id)
            return !isDuplicate && !isParent && !isChild && !isCoparent
        })
    }

    render() {
        const { id, name, path, children, weight, isTopic } = this.props.node
        const serializedPath = path.join("-")
        return (
            // IDs can't start with a number, so we prefix with "node-"
            // Not using data- attributes because they don't work with DndContext
            <DraggableDroppable
                key={id}
                id={`node-${serializedPath}`}
                className="tag-box"
                disableDroppable={this.props.disableDroppable}
            >
                <TagBadge tag={{ id, name }} />
                {isTopic ? (
                    <span
                        className="tag-box__is-topic"
                        title="This tag has a topic page"
                    >
                        ⭐️
                    </span>
                ) : null}
                {this.coparents.length > 0 ? (
                    <p>
                        This tag is also a child of:{" "}
                        {this.coparents.map((tag) => tag.name).join(", ")}
                    </p>
                ) : null}
                <div className="tag-box__controls-container">
                    <span className="tag-box__weight-control">
                        <label htmlFor={`weight-${serializedPath}`}>
                            Weight
                        </label>
                        <input
                            id={`weight-${serializedPath}`}
                            type="number"
                            value={weight}
                            onChange={this.handleUpdateWeight}
                        />
                    </span>
                    <AddChildForm
                        label="Add child"
                        parentId={id}
                        setChild={this.props.setChild}
                        tags={this.addableTags}
                    />
                    <Popconfirm
                        title={
                            <div>
                                <strong>
                                    Are you sure you want to remove this tag
                                    relationship?
                                </strong>
                                <div>
                                    Child tag relationships will also be removed
                                    unless they are referenced elsewhere.
                                </div>
                            </div>
                        }
                        onConfirm={() =>
                            this.props.removeNode(path.at(-2)!, id)
                        }
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button danger className="tag-box__delete-tag-button">
                            Remove
                        </Button>
                    </Popconfirm>
                </div>
                {children.map((node) => (
                    <TagGraphNodeContainer
                        key={node.id}
                        node={node}
                        tags={this.props.tags}
                        parentId={id}
                        parentsById={this.props.parentsById}
                        setWeight={this.props.setWeight}
                        removeNode={this.props.removeNode}
                        setChild={this.props.setChild}
                        disableDroppable={this.props.disableDroppable}
                    />
                ))}
            </DraggableDroppable>
        )
    }
}

function sortByWeightThenName(a: FlatTagGraphNode, b: FlatTagGraphNode) {
    return b.weight - a.weight || a.name.localeCompare(b.name)
}

// "node-1-2-3" -> [1, 2, 3]
function getPath(elementId?: string): number[] {
    if (!elementId) return []
    return elementId.split("-").slice(1).map(Number)
}

function insertChildAndSort(
    children: FlatTagGraphNode[] = [],
    newNode: FlatTagGraphNode
): FlatTagGraphNode[] {
    return [...children, newNode].sort(sortByWeightThenName)
}

@observer
export class TagGraphPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    constructor(props: Readonly<unknown>) {
        super(props)
        this.handleDragEnd = this.handleDragEnd.bind(this)
        this.setWeight = this.setWeight.bind(this)
        this.setChild = this.setChild.bind(this)
        this.removeNode = this.removeNode.bind(this)
    }

    @observable flatTagGraph: FlatTagGraph = {}
    @observable rootId: number | null = null
    @observable addTagParentId?: number
    @observable tags: MinimalTagWithIsTopic[] = []

    @computed get tagGraph(): TagGraphRoot | null {
        if (!this.rootId) return null
        return createTagGraph(this.flatTagGraph, this.rootId)
    }

    @computed get parentsById(): Record<string, MinimalTagWithIsTopic[]> {
        if (!this.tagGraph) return {}
        const parentsById: Record<string, MinimalTagWithIsTopic[]> = {}
        for (const [parentId, children] of Object.entries(this.flatTagGraph)) {
            for (const child of children) {
                const parent = this.tags.find(
                    (tag) => tag.id === Number(parentId)
                )
                if (parent) {
                    if (!parentsById[child.childId]) {
                        parentsById[child.childId] = [parent]
                    } else {
                        parentsById[child.childId].push(parent)
                    }
                }
            }
        }
        return parentsById
    }

    @computed get nonAreaTags() {
        if (!this.rootId) return []
        const areaTags = this.flatTagGraph[this.rootId]
        const areaTagIds = areaTags?.map((tag) => tag.childId) || []
        return this.tags.filter((tag) => !areaTagIds.includes(tag.id))
    }

    getAllChildrenOfNode(childId: number): FlatTagGraphNode[] {
        const allChildren: FlatTagGraphNode[] =
            toJS(this.flatTagGraph[childId]) || []

        for (const child of allChildren) {
            if (this.flatTagGraph[child.childId]) {
                allChildren.push(...this.flatTagGraph[child.childId])
            }
        }

        return allChildren
    }

    @action.bound setWeight(parentId: number, childId: number, weight: number) {
        const parent = this.flatTagGraph[parentId]
        if (!parent) return
        const child = parent.find((node) => node.childId === childId)
        if (!child) return
        child.weight = weight
        this.flatTagGraph[parentId] = parent.sort(sortByWeightThenName)
    }

    @action.bound setChild(parentId: number, childId: number) {
        const siblings = this.flatTagGraph[parentId]
        const tag = this.tags.find((tag) => tag.id === childId)
        if (!tag) return
        const child: FlatTagGraphNode = {
            childId: tag.id,
            parentId: parentId,
            name: tag.name,
            weight: 100,
            slug: tag.slug,
            isTopic: tag.isTopic,
        }
        if (siblings) {
            this.flatTagGraph[parentId] = insertChildAndSort(siblings, child)
        } else {
            this.flatTagGraph[parentId] = [child]
        }
    }

    @action.bound removeNode(parentId: number, childId: number) {
        const children = this.flatTagGraph[parentId]
        if (!children) return

        // Remove the child from its parent. If there are no other children, delete the record
        const remainingChildren = this.flatTagGraph[parentId].filter(
            (node) => node.childId !== childId
        )
        if (remainingChildren.length) {
            this.flatTagGraph[parentId] = remainingChildren
        } else {
            delete this.flatTagGraph[parentId]
        }

        // If the child had no other parents, delete its grandchildren also
        // i.e. if you delete the "Health" area, the subgraph (Diseases -> Cardiovascular Disease, Cancer) will also be deleted,
        // but the subgraph (Air Pollution -> Indoor Air Pollution, Outdoor Air Pollution) won't be, because it's still a child of "Energy and Environment"
        const hasMultipleParents = this.parentsById[childId]
        if (!hasMultipleParents) return

        const grandchildren = this.flatTagGraph[childId]
        if (!grandchildren) return

        for (const grandchild of grandchildren) {
            this.removeNode(childId, grandchild.childId)
        }
    }

    @action.bound handleDragEnd(event: DragEndEvent) {
        if (!this.tagGraph) return

        const activeHtmlId = event.active.id as string
        const overHtmlId = event.over?.id as string
        if (!activeHtmlId || !overHtmlId) return

        const childPath = getPath(activeHtmlId)
        const newParentPath = getPath(overHtmlId)
        const previousParentPath = childPath.slice(0, -1)
        if (!childPath || !newParentPath || !previousParentPath) return

        const childId = childPath.at(-1)
        const newParentId = newParentPath.at(-1)
        const previousParentId = previousParentPath.at(-1)
        if (!childId || !previousParentId || !newParentId) return

        const childNode = this.flatTagGraph[previousParentId].find(
            (node) => node.childId === childId
        )
        if (!childNode) return

        const isNoop = lodash.isEqual(previousParentPath, newParentPath)
        if (isNoop) return

        // Prevents these two structures:
        // Parantheses indicate the subgraph that was dagged
        // Energy -> (Energy)
        // Nuclear Energy -> (Energy -> Nuclear Energy)
        const allChildrenOfChild = this.getAllChildrenOfNode(childId)
        const isCyclical = [childNode, ...allChildrenOfChild].find((child) =>
            newParentPath.includes(child.childId)
        )
        if (isCyclical) {
            alert("This operation would create a cycle")
            return
        }
        const isSibling = this.flatTagGraph[newParentId]?.find(
            (node) => node.childId === childId
        )
        if (isSibling) {
            alert("This parent already has this child")
            return
        }

        // Add child to new parent
        childNode.parentId = newParentId
        this.flatTagGraph[newParentId] = insertChildAndSort(
            this.flatTagGraph[newParentId],
            childNode
        )

        // Remove child from previous parent
        this.flatTagGraph[previousParentId] = this.flatTagGraph[
            previousParentId
        ].filter((node) => node.childId !== childId)
    }

    @action.bound async saveTagGraph() {
        if (!this.tagGraph) return
        await this.context.admin.requestJSON(
            "/api/tagGraph",
            { tagGraph: toJS(this.flatTagGraph) },
            "POST"
        )
    }

    render() {
        return (
            <AdminLayout title="Tag Graph">
                <main className="TagGraphPage">
                    <header className="page-header">
                        <h2>Tag Graph</h2>
                        <div>
                            <AddChildForm
                                tags={this.nonAreaTags}
                                parentId={this.rootId!}
                                setChild={this.setChild}
                                label="Add area"
                            />
                            <Button type="primary" onClick={this.saveTagGraph}>
                                Save
                            </Button>
                        </div>
                    </header>
                    <p>
                        Drag and drop tags according to their hierarchy. Top
                        level tags should be areas. Tags are ordered by weight
                        (higher weights first) and then by name. To add a new
                        tag, visit the <Link to="/tags">tags page</Link>.
                    </p>
                    <DndContext
                        onDragEnd={this.handleDragEnd}
                        collisionDetection={pointerWithin}
                    >
                        <DraggableDroppable
                            id={`node-${this.rootId}`}
                            className="root-tag-box"
                        >
                            {this.tagGraph?.children.map((node) => (
                                <TagGraphNodeContainer
                                    key={node.id}
                                    node={node}
                                    tags={this.tags}
                                    parentsById={this.parentsById}
                                    parentId={this.tagGraph!.id}
                                    setWeight={this.setWeight}
                                    setChild={this.setChild}
                                    removeNode={this.removeNode}
                                />
                            ))}
                        </DraggableDroppable>
                    </DndContext>
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const flatTagGraph = await this.context.admin.getJSON<
            FlatTagGraph & {
                __rootId: number
            }
        >("/api/flatTagGraph.json")

        const tags = await this.context.admin
            .getJSON<{ tags: MinimalTagWithIsTopic[] }>("/api/tags.json")
            .then((data) => data.tags)

        runInAction(() => {
            const { __rootId, ...rest } = flatTagGraph
            this.rootId = __rootId
            this.flatTagGraph = rest
            this.tags = tags
        })
    }

    componentDidMount() {
        void this.getData()
    }
}
