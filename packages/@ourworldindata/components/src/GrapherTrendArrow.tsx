import cx from "classnames"

const ARROW_PATHS = {
    up: "m14,0H5c-.552,0-1,.448-1,1s.448,1,1,1h6.586L.29303,13.29297l1.41394,1.414L13,3.41394v6.58606c0,.552.448,1,1,1s1-.448,1-1V1c0-.552-.448-1-1-1Z",
    down: "m14,4c-.552,0-1,.448-1,1v6.586L1.56049.14648.14655,1.56042l11.43958,11.43958h-6.58612c-.552,0-1,.448-1,1s.448,1,1,1h9c.552,0,1-.448,1-1V5c0-.552-.448-1-1-1Z",
    right: "m19.59198,6.82422L13.22803.46021c-.39105-.39099-1.02405-.39099-1.414,0-.39105.39001-.39105,1.02405,0,1.414l4.65698,4.65704H.5v2h15.97101l-4.65698,4.65698c-.39105.39001-.39105,1.02399,0,1.414.38995.39099,1.02295.39099,1.414,0l6.36395-6.36401c.39001-.39001.39001-1.02399,0-1.414Z",
} as const

export function GrapherTrendArrow({
    direction,
}: {
    direction: "up" | "right" | "down"
}): React.ReactElement {
    return (
        <svg
            className={cx("GrapherTrendArrow", direction)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${direction === "right" ? 20 : 15} 15`}
        >
            <path d={ARROW_PATHS[direction]} />
        </svg>
    )
}
