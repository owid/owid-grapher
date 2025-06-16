/* eslint-disable */
/*
Duplication of d3-geo-projection.geoPatterson && d3-geo-projection.geoRobinson
for webpack bundlesize purposes, as the original module wasn't tree-shakeable

Copyright 2013-2021 Mike Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

MIT License for https://github.com/scijs/integrate-adaptive-simpson

The MIT License (MIT)

Copyright 2015 Ricky Reusser

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import { geoProjection, GeoProjection } from "d3-geo"

const epsilon = 1e-6
const epsilon2 = 1e-12
const pi = Math.PI
const halfPi = pi / 2
const degrees = 180 / pi
const radians = pi / 180

// https://github.com/d3/d3-geo-projection/blob/main/src/patterson.js
const pattersonK1 = 1.0148,
    pattersonK2 = 0.23185,
    pattersonK3 = -0.14499,
    pattersonK4 = 0.02406,
    pattersonC1 = pattersonK1,
    pattersonC2 = 5 * pattersonK2,
    pattersonC3 = 7 * pattersonK3,
    pattersonC4 = 9 * pattersonK4,
    pattersonYmax = 1.790857183

export function pattersonRaw(lambda: number, phi: number): [number, number] {
    const phi2 = phi * phi
    return [
        lambda,
        phi *
            (pattersonK1 +
                phi2 *
                    phi2 *
                    (pattersonK2 + phi2 * (pattersonK3 + pattersonK4 * phi2))),
    ]
}

pattersonRaw.invert = function (x: number, y: number): [number, number] {
    if (y > pattersonYmax) y = pattersonYmax
    else if (y < -pattersonYmax) y = -pattersonYmax
    let yc = y,
        delta

    do {
        // Newton-Raphson
        const y2 = yc * yc
        yc -= delta =
            (yc *
                (pattersonK1 +
                    y2 *
                        y2 *
                        (pattersonK2 + y2 * (pattersonK3 + pattersonK4 * y2))) -
                y) /
            (pattersonC1 +
                y2 * y2 * (pattersonC2 + y2 * (pattersonC3 + pattersonC4 * y2)))
    } while (Math.abs(delta) > epsilon)

    return [x, yc]
}

export function geoPatterson(): GeoProjection {
    return geoProjection(pattersonRaw).scale(139.319)
}

// https://github.com/d3/d3-geo-projection/blob/main/src/robinson.js
const K = [
    [0.9986, -0.062],
    [1.0, 0.0],
    [0.9986, 0.062],
    [0.9954, 0.124],
    [0.99, 0.186],
    [0.9822, 0.248],
    [0.973, 0.31],
    [0.96, 0.372],
    [0.9427, 0.434],
    [0.9216, 0.4958],
    [0.8962, 0.5571],
    [0.8679, 0.6176],
    [0.835, 0.6769],
    [0.7986, 0.7346],
    [0.7597, 0.7903],
    [0.7186, 0.8435],
    [0.6732, 0.8936],
    [0.6213, 0.9394],
    [0.5722, 0.9761],
    [0.5322, 1.0],
]

K.forEach(function (d) {
    d[1] *= 1.0144
})

export function robinsonRaw(lambda: number, phi: number): [number, number] {
    let k
    let i = Math.min(18, (Math.abs(phi) * 36) / pi),
        i0 = Math.floor(i),
        di = i - i0,
        ax = (k = K[i0])[0],
        ay = k[1],
        bx = (k = K[++i0])[0],
        by = k[1],
        cx = (k = K[Math.min(19, ++i0)])[0],
        cy = k[1]
    return [
        lambda *
            (bx + (di * (cx - ax)) / 2 + (di * di * (cx - 2 * bx + ax)) / 2),
        (phi > 0 ? halfPi : -halfPi) *
            (by + (di * (cy - ay)) / 2 + (di * di * (cy - 2 * by + ay)) / 2),
    ]
}

robinsonRaw.invert = function (x: number, y: number): [number, number] {
    let yy = y / halfPi,
        phi = yy * 90,
        i = Math.min(18, Math.abs(phi / 5)),
        i0 = Math.max(0, Math.floor(i))
    do {
        var ay = K[i0][1],
            by = K[i0 + 1][1],
            cy = K[Math.min(19, i0 + 2)][1],
            u = cy - ay,
            v = cy - 2 * by + ay,
            t = (2 * (Math.abs(yy) - by)) / u,
            c = v / u,
            di = t * (1 - c * t * (1 - 2 * c * t))
        if (di >= 0 || i0 === 1) {
            phi = (y >= 0 ? 5 : -5) * (di + i)
            var j = 50,
                delta
            do {
                i = Math.min(18, Math.abs(phi) / 5)
                i0 = Math.floor(i)
                di = i - i0
                ay = K[i0][1]
                by = K[i0 + 1][1]
                cy = K[Math.min(19, i0 + 2)][1]
                phi -=
                    (delta =
                        (y >= 0 ? halfPi : -halfPi) *
                            (by +
                                (di * (cy - ay)) / 2 +
                                (di * di * (cy - 2 * by + ay)) / 2) -
                        y) * degrees
            } while (Math.abs(delta) > epsilon2 && --j > 0)
            break
        }
    } while (--i0 >= 0)
    const ax = K[i0][0],
        bx = K[i0 + 1][0],
        cx = K[Math.min(19, i0 + 2)][0]
    return [
        x / (bx + (di * (cx - ax)) / 2 + (di * di * (cx - 2 * bx + ax)) / 2),
        phi * radians,
    ]
}

export function geoRobinson(): GeoProjection {
    return geoProjection(robinsonRaw).scale(152.63)
}
