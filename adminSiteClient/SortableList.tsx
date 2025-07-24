// This sortable list implementation is taken from https://codesandbox.io/p/sandbox/dnd-kit-sortable-starter-template-22x1ix?file=%2Fsrc%2Fcomponents%2FSortableList%2FSortableList.tsx%3A11%2C9

import React, { useMemo, useState, createContext, useContext } from "react"
import type { ReactNode, CSSProperties, PropsWithChildren } from "react"
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import type {
    Active,
    UniqueIdentifier,
    DraggableSyntheticListeners,
    DropAnimation,
} from "@dnd-kit/core"
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable"

import { CSS } from "@dnd-kit/utilities"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGripVertical } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"

interface SortableItemProps {
    id: UniqueIdentifier
    className?: string
}

interface Context {
    attributes: Record<string, any>
    listeners: DraggableSyntheticListeners
    ref(node: HTMLElement | null): void
}

const SortableItemContext = createContext<Context>({
    attributes: {},
    listeners: undefined,
    ref() {
        // This is a no-op function to satisfy the context type
    },
})

export function SortableItem({
    children,
    id,
    className,
}: PropsWithChildren<SortableItemProps>) {
    const {
        attributes,
        isDragging,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
    } = useSortable({ id })
    const context = useMemo(
        () => ({
            attributes,
            listeners,
            ref: setActivatorNodeRef,
        }),
        [attributes, listeners, setActivatorNodeRef]
    )
    const style: CSSProperties = {
        opacity: isDragging ? 0.4 : undefined,
        transform: CSS.Translate.toString(transform),
        transition,
    }

    return (
        <SortableItemContext.Provider value={context}>
            <li
                className={cx("SortableList__item", className)}
                ref={setNodeRef}
                style={style}
            >
                {children}
            </li>
        </SortableItemContext.Provider>
    )
}

export function DragHandle() {
    const { attributes, listeners, ref } = useContext(SortableItemContext)

    return (
        <button
            className="SortableList__handle"
            {...attributes}
            {...listeners}
            ref={ref}
        >
            <FontAwesomeIcon icon={faGripVertical} />
        </button>
    )
}

const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: "0.4",
            },
        },
    }),
}

export function SortableOverlay({ children }: PropsWithChildren) {
    return (
        <DragOverlay dropAnimation={dropAnimationConfig}>
            {children}
        </DragOverlay>
    )
}

interface BaseItem {
    id: UniqueIdentifier
}

interface Props<T extends BaseItem> {
    items: T[]
    onChange(items: T[]): void
    renderItem(item: T): ReactNode
    isDndEnabled?: boolean
}

export function SortableList<T extends BaseItem>({
    items,
    onChange,
    renderItem,
    isDndEnabled = true,
}: Props<T>) {
    const [active, setActive] = useState<Active | null>(null)
    const activeItem = useMemo(
        () => items.find((item) => item.id === active?.id),
        [active, items]
    )
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    return (
        <DndContext
            sensors={sensors}
            onDragStart={({ active }) => {
                setActive(active)
            }}
            onDragEnd={({ active, over }) => {
                if (over && active.id !== over?.id) {
                    const activeIndex = items.findIndex(
                        ({ id }) => id === active.id
                    )
                    const overIndex = items.findIndex(
                        ({ id }) => id === over.id
                    )

                    onChange(arrayMove(items, activeIndex, overIndex))
                }
                setActive(null)
            }}
            onDragCancel={() => {
                setActive(null)
            }}
        >
            <SortableContext items={items} disabled={!isDndEnabled}>
                <ul className="SortableList">
                    {items.map((item) => (
                        <React.Fragment key={item.id}>
                            {renderItem(item)}
                        </React.Fragment>
                    ))}
                </ul>
            </SortableContext>
            <SortableOverlay>
                {activeItem ? renderItem(activeItem) : null}
            </SortableOverlay>
        </DndContext>
    )
}

SortableList.Item = SortableItem
SortableList.DragHandle = DragHandle
