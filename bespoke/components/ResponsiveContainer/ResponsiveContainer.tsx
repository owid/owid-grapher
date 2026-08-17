import { useParentSize } from "@visx/responsive"

/**
 * Fills its parent and hands the measured size to its children, which only
 * render once there is one. Charts sized from props need this wrapper.
 */
export function ResponsiveContainer({
    style,
    children,
}: {
    style?: React.CSSProperties
    children: (size: { width: number; height: number }) => React.ReactNode
}): React.ReactElement {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container" style={style}>
            {width > 0 && height > 0 && children({ width, height })}
        </div>
    )
}
