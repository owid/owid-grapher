import { GeoProjection } from "d3-geo"
// @ts-expect-error no types available
import versor from "versor"
import type { Position } from "./PanAndZoomGesture"

/** D3 projection rotation: [-longitude, -latitude] */
export type GlobeRotation = [lambda: number, phi: number]

type Cartesian = [number, number, number]
type Quaternion = [number, number, number, number]

export interface GlobeDrag {
    startCartesian: Cartesian
    startRotation: [number, number, number]
    startQuaternion: Quaternion
    previousPosition: Position
}

interface Circle {
    center: Position
    radius: number
}

// Degrees per pixel when dragging outside the globe.
const OUTSIDE_DRAG_SENSITIVITY = 0.8

export function startGlobeDrag(
    projection: GeoProjection,
    position: Position
): GlobeDrag {
    const startRotation = projection.rotate()
    return {
        startCartesian: versor.cartesian(projection.invert!(position)),
        startRotation,
        startQuaternion: versor(startRotation),
        previousPosition: position,
    }
}

/**
 * Return the rotation and next drag state. On-globe drags anchor the grabbed
 * geographic point; off-globe drags rotate proportionally to pointer movement.
 * Adapted from https://observablehq.com/d/569d101dd5bd332b;
 * see https://www.jasondavies.com/maps/rotate/ for the geometry.
 */
export function dragGlobe(
    projection: GeoProjection,
    drag: GlobeDrag,
    position: Position,
    globe: Circle
): { rotation: GlobeRotation; drag: GlobeDrag } {
    const nextDrag = { ...drag, previousPosition: position }

    if (isPointInCircle(position, globe)) {
        // Use the initial rotation to keep movement relative to the grabbed point.
        const currentRotation = projection.rotate()
        const currentCartesian = versor.cartesian(
            projection.rotate(drag.startRotation).invert!(position)
        )
        projection.rotate(currentRotation)

        const delta = versor.delta(drag.startCartesian, currentCartesian)
        const quaternion = versor.multiply(drag.startQuaternion, delta)
        const rotation = versor.rotation(quaternion)

        // Ignore roll for intuitive dragging, at the cost of accuracy near the poles.
        // See https://observablehq.com/@d3/three-axis-rotation.
        return { rotation: [rotation[0], rotation[1]], drag: nextDrag }
    }

    const [lambda, phi] = projection.rotate()
    const dx = position[0] - drag.previousPosition[0]
    const dy = position[1] - drag.previousPosition[1]
    return {
        rotation: [
            lambda + OUTSIDE_DRAG_SENSITIVITY * dx,
            phi - OUTSIDE_DRAG_SENSITIVITY * dy,
        ],
        drag: nextDrag,
    }
}

function isPointInCircle(point: Position, circle: Circle): boolean {
    const [x, y] = point
    const [cx, cy] = circle.center
    return (x - cx) ** 2 + (y - cy) ** 2 <= circle.radius ** 2
}
