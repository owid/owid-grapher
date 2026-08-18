import { useParentSize } from "@visx/responsive"

/**
 * Fills its parent and hands the measured dimensions to its children, which
 * only render once there are some.
 */
export function ResponsiveContainer({
    style,
    children,
}: {
    style?: React.CSSProperties
    children: (dimensions: { width: number; height: number }) => React.ReactNode
}): React.ReactElement {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container" style={style}>
            {width > 0 && height > 0 && children({ width, height })}
        </div>
    )
}
