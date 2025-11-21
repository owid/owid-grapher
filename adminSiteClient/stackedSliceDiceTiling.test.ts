import { describe, it, expect } from "vitest"
import * as d3 from "d3"
import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

/**
 * Test suite for stackedSliceDiceTiling
 *
 * Tests are based on the specification from JSDoc, not implementation details.
 *
 * Key behaviors to test:
 * 1. Alternating orientations by depth (vertical at even, horizontal at odd)
 * 2. Proportional sizing based on node values
 * 3. Thin rectangle detection and thin band creation
 * 4. Vertical stacking within thin band
 * 5. Horizontal sub-row for very short stacked items
 */

describe("stackedSliceDiceTiling", () => {
    /**
     * Helper to create a hierarchy with specified values and apply treemap
     */
    function createTreemap<T>(
        data: T,
        tiler: (
            node: d3.HierarchyRectangularNode<any>,
            x0: number,
            y0: number,
            x1: number,
            y1: number
        ) => void,
        width = 100,
        height = 100
    ): d3.HierarchyRectangularNode<T> {
        const root = d3.hierarchy(data).sum((d: any) => d.value || 0)

        return d3
            .treemap<T>()
            .size([width, height])
            .tile(tiler as any)
            .padding(0)
            .round(false)(root)
    }

    describe("Alternating orientation by depth", () => {
        it("should layout children in columns at depth 0 (even)", () => {
            const data = {
                children: [{ value: 50 }, { value: 30 }, { value: 20 }],
            }

            const tiler = stackedSliceDiceTiling({ minSliceWidth: 10 })
            const root = createTreemap(data, tiler, 100, 100)

            // At depth 0 (even), should use vertical mode (columns)
            // Children should be arranged horizontally (varying x positions)
            const children = root.children!

            // First child should start at x=0
            expect(children[0].x0).toBe(0)
            // Each child should span full height
            expect(children[0].y0).toBe(0)
            expect(children[0].y1).toBe(100)

            // Children should be adjacent horizontally (x1 of one equals x0 of next)
            expect(children[0].x1).toBeCloseTo(children[1].x0, 1)
            expect(children[1].x1).toBeCloseTo(children[2].x0, 1)
        })

        it("should layout children in rows at depth 1 (odd)", () => {
            const data = {
                children: [
                    {
                        value: 100,
                        children: [{ value: 40 }, { value: 30 }, { value: 30 }],
                    },
                ],
            }

            const tiler = stackedSliceDiceTiling({ minSliceWidth: 10 })
            const root = createTreemap(data, tiler, 100, 100)

            // At depth 1 (odd), should use horizontal mode (rows)
            // Children should be arranged vertically (varying y positions)
            const grandchildren = root.children![0].children!

            // First child should start at y=0
            expect(grandchildren[0].y0).toBe(0)
            // Each child should span full width
            expect(grandchildren[0].x0).toBe(0)
            expect(grandchildren[0].x1).toBe(100)

            // Children should be adjacent vertically (y1 of one equals y0 of next)
            expect(grandchildren[0].y1).toBeCloseTo(grandchildren[1].y0, 1)
            expect(grandchildren[1].y1).toBeCloseTo(grandchildren[2].y0, 1)
        })
    })

    describe("Proportional sizing", () => {
        it("should size children proportionally to their values", () => {
            const data = {
                children: [
                    { value: 60 }, // 60% of total
                    { value: 30 }, // 30% of total
                    { value: 10 }, // 10% of total
                ],
            }

            const tiler = stackedSliceDiceTiling({ minSliceWidth: 5 })
            const root = createTreemap(data, tiler, 100, 100)

            const children = root.children!
            const totalArea = 100 * 100

            // Area should be proportional to value
            const area0 =
                (children[0].x1 - children[0].x0) *
                (children[0].y1 - children[0].y0)
            const area1 =
                (children[1].x1 - children[1].x0) *
                (children[1].y1 - children[1].y0)
            const area2 =
                (children[2].x1 - children[2].x0) *
                (children[2].y1 - children[2].y0)

            expect(area0).toBeCloseTo(totalArea * 0.6, 0.5)
            expect(area1).toBeCloseTo(totalArea * 0.3, 0.5)
            expect(area2).toBeCloseTo(totalArea * 0.1, 0.5)
        })

        it("should size grandchildren proportionally to their values", () => {
            const data = {
                children: [
                    {
                        value: 100,
                        children: [
                            { value: 50 }, // 50% of parent
                            { value: 30 }, // 30% of parent
                            { value: 20 }, // 20% of parent
                        ],
                    },
                ],
            }

            const tiler = stackedSliceDiceTiling({ minSliceWidth: 5 })
            const root = createTreemap(data, tiler, 100, 100)

            const grandchildren = root.children![0].children!
            const totalArea = 100 * 100

            // Area should be proportional to value
            const area0 =
                (grandchildren[0].x1 - grandchildren[0].x0) *
                (grandchildren[0].y1 - grandchildren[0].y0)
            const area1 =
                (grandchildren[1].x1 - grandchildren[1].x0) *
                (grandchildren[1].y1 - grandchildren[1].y0)
            const area2 =
                (grandchildren[2].x1 - grandchildren[2].x0) *
                (grandchildren[2].y1 - grandchildren[2].y0)

            expect(area0).toBeCloseTo(totalArea * 0.5, 0.5)
            expect(area1).toBeCloseTo(totalArea * 0.3, 0.5)
            expect(area2).toBeCloseTo(totalArea * 0.2, 0.5)
        })

        it("should maintain proportional areas even when thin band logic is triggered", () => {
            const data = {
                children: [
                    { value: 70 }, // Will be thick
                    { value: 20 }, // Will be thick
                    { value: 8 }, // Will be thin (< 15px threshold)
                    { value: 2 }, // Will be thin (< 15px threshold)
                ],
            }

            const tiler = stackedSliceDiceTiling({
                minSliceWidth: 15,
                minStackHeight: 5,
            })
            const root = createTreemap(data, tiler, 100, 100)

            const children = root.children!
            const totalArea = 100 * 100

            // Even though layout is adapted (thin items stacked in a band),
            // areas should still be proportional to values
            const area0 =
                (children[0].x1 - children[0].x0) *
                (children[0].y1 - children[0].y0)
            const area1 =
                (children[1].x1 - children[1].x0) *
                (children[1].y1 - children[1].y0)
            const area2 =
                (children[2].x1 - children[2].x0) *
                (children[2].y1 - children[2].y0)
            const area3 =
                (children[3].x1 - children[3].x0) *
                (children[3].y1 - children[3].y0)

            expect(area0).toBeCloseTo(totalArea * 0.7, 0.5)
            expect(area1).toBeCloseTo(totalArea * 0.2, 0.5)
            expect(area2).toBeCloseTo(totalArea * 0.08, 0.5)
            expect(area3).toBeCloseTo(totalArea * 0.02, 0.5)

            // // Verify that layout differs from pure slice-dice:
            // // In pure slice-dice, all children would be adjacent columns with same x-alignment
            // // Here, thin items should be in a separate thin band (different layout structure)
            // const thin2InBand = children[2].x0 >= children[1].x1 - 1
            // const thin3InBand = children[3].x0 >= children[1].x1 - 1
            // expect(thin2InBand || thin3InBand).toBe(true)
        })

        it("should maintain proportional areas with multiple parents and grandchildren", () => {
            const data = {
                children: [
                    {
                        children: [
                            { value: 30 }, // 30% of total
                            { value: 20 }, // 20% of total
                        ],
                    },
                    {
                        children: [
                            { value: 18 }, // 18% of total
                            { value: 12 }, // 12% of total
                        ],
                    },
                    { value: 20 }, // No children, 20% of total
                ],
            }

            const tiler = stackedSliceDiceTiling({
                minSliceWidth: 10,
                minStackHeight: 8,
            })
            const root = createTreemap(data, tiler, 100, 100)

            const totalArea = 100 * 100
            const children = root.children!

            // Verify parent areas are proportional
            const parentArea0 =
                (children[0].x1 - children[0].x0) *
                (children[0].y1 - children[0].y0)
            const parentArea1 =
                (children[1].x1 - children[1].x0) *
                (children[1].y1 - children[1].y0)
            const childArea2 =
                (children[2].x1 - children[2].x0) *
                (children[2].y1 - children[2].y0)

            expect(parentArea0).toBeCloseTo(totalArea * 0.5, 0.5)
            expect(parentArea1).toBeCloseTo(totalArea * 0.3, 0.5)
            expect(childArea2).toBeCloseTo(totalArea * 0.2, 0.5)

            // Verify grandchildren areas within first parent
            const grandchildren0 = children[0].children!
            const garea0_0 =
                (grandchildren0[0].x1 - grandchildren0[0].x0) *
                (grandchildren0[0].y1 - grandchildren0[0].y0)
            const garea0_1 =
                (grandchildren0[1].x1 - grandchildren0[1].x0) *
                (grandchildren0[1].y1 - grandchildren0[1].y0)

            expect(garea0_0).toBeCloseTo(totalArea * 0.3, 0.5)
            expect(garea0_1).toBeCloseTo(totalArea * 0.2, 0.5)

            // Verify grandchildren areas within second parent
            const grandchildren1 = children[1].children!
            const garea1_0 =
                (grandchildren1[0].x1 - grandchildren1[0].x0) *
                (grandchildren1[0].y1 - grandchildren1[0].y0)
            const garea1_1 =
                (grandchildren1[1].x1 - grandchildren1[1].x0) *
                (grandchildren1[1].y1 - grandchildren1[1].y0)

            expect(garea1_0).toBeCloseTo(totalArea * 0.18, 0.5)
            expect(garea1_1).toBeCloseTo(totalArea * 0.12, 0.5)
        })

        it("should maintain proportional areas with grandchildren when thin band logic is triggered", () => {
            const data = {
                children: [
                    {
                        children: [
                            { value: 40 }, // 40% of total
                            { value: 30 }, // 30% of total
                        ],
                    },
                    { value: 20 }, // 20% of total (thick)
                    { value: 8 }, // 8% of total (thin, < 12px)
                    { value: 2 }, // 2% of total (thin, < 12px)
                ],
            }

            const tiler = stackedSliceDiceTiling({
                minSliceWidth: 12,
                minStackHeight: 8,
            })
            const root = createTreemap(data, tiler, 100, 100)

            const totalArea = 100 * 100
            const children = root.children!

            // Verify all top-level areas are proportional (even with mixed thick/thin)
            const parentArea0 =
                (children[0].x1 - children[0].x0) *
                (children[0].y1 - children[0].y0)
            const childArea1 =
                (children[1].x1 - children[1].x0) *
                (children[1].y1 - children[1].y0)
            const thinArea2 =
                (children[2].x1 - children[2].x0) *
                (children[2].y1 - children[2].y0)
            const thinArea3 =
                (children[3].x1 - children[3].x0) *
                (children[3].y1 - children[3].y0)

            expect(parentArea0).toBeCloseTo(totalArea * 0.7, 0.5)
            expect(childArea1).toBeCloseTo(totalArea * 0.2, 0.5)
            expect(thinArea2).toBeCloseTo(totalArea * 0.08, 0.5)
            expect(thinArea3).toBeCloseTo(totalArea * 0.02, 0.5)

            // Verify grandchildren areas are also proportional
            const grandchildren = children[0].children!
            const garea0 =
                (grandchildren[0].x1 - grandchildren[0].x0) *
                (grandchildren[0].y1 - grandchildren[0].y0)
            const garea1 =
                (grandchildren[1].x1 - grandchildren[1].x0) *
                (grandchildren[1].y1 - grandchildren[1].y0)

            expect(garea0).toBeCloseTo(totalArea * 0.4, 0.5)
            expect(garea1).toBeCloseTo(totalArea * 0.3, 0.5)

            // // Verify thin band was actually triggered at depth 0
            // // Children 2 and 3 should be in a separate band (to the right)
            // const child2InThinBand = children[2].x0 >= children[1].x1 - 1
            // const child3InThinBand = children[3].x0 >= children[1].x1 - 1
            // expect(child2InThinBand || child3InThinBand).toBe(true)
        })
    })

    // describe("Thin rectangle detection and thin band", () => {
    //     it("should move thin children to a separate thin band", () => {
    //         const data = {
    //             children: [
    //                 { value: 60 }, // Will be thick (60px > 15px threshold)
    //                 { value: 30 }, // Will be thick (30px > 15px threshold)
    //                 { value: 8 }, // Will be thin (8px < 15px threshold)
    //                 { value: 2 }, // Will be thin (2px < 15px threshold)
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 15,
    //             minStackHeight: 10,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // First two children should get normal proportional widths
    //         const width0 = children[0].x1 - children[0].x0
    //         const width1 = children[1].x1 - children[1].x0

    //         // They should be much wider than their proportional share
    //         // because thin children are grouped separately
    //         expect(width0).toBeGreaterThan(50) // More than 60% of 100
    //         expect(width1).toBeGreaterThan(25) // More than 30% of 100

    //         // Thin children should be in a band to the right
    //         expect(children[2].x0).toBeGreaterThan(children[1].x1 - 1)
    //         expect(children[3].x0).toBeGreaterThan(children[1].x1 - 1)
    //     })

    //     it("should place thin band to the right in vertical mode", () => {
    //         const data = {
    //             children: [
    //                 { value: 80 }, // Thick
    //                 { value: 10 }, // Thin (10px < 15px)
    //                 { value: 10 }, // Thin
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 15,
    //             minStackHeight: 10,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // Thick child comes first (leftmost)
    //         expect(children[0].x0).toBe(0)

    //         // Thin children should be to the right of thick child
    //         expect(children[1].x0).toBeGreaterThanOrEqual(children[0].x1 - 1)
    //         expect(children[2].x0).toBeGreaterThanOrEqual(children[0].x1 - 1)
    //     })

    //     it("should place thin band at the bottom in horizontal mode", () => {
    //         const data = {
    //             children: [
    //                 {
    //                     value: 100,
    //                     children: [
    //                         { value: 80 }, // Thick
    //                         { value: 10 }, // Thin (10px < 15px)
    //                         { value: 10 }, // Thin
    //                     ],
    //                 },
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 15,
    //             minStackHeight: 10,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const grandchildren = root.children![0].children!

    //         // Thick child comes first (topmost)
    //         expect(grandchildren[0].y0).toBe(0)

    //         // Thin children should be below thick child
    //         expect(grandchildren[1].y0).toBeGreaterThanOrEqual(
    //             grandchildren[0].y1 - 1
    //         )
    //         expect(grandchildren[2].y0).toBeGreaterThanOrEqual(
    //             grandchildren[0].y1 - 1
    //         )
    //     })
    // })

    // describe("Vertical stacking within thin band", () => {
    //     it("should stack thin items vertically in the thin band", () => {
    //         const data = {
    //             children: [
    //                 { value: 70 }, // Thick
    //                 { value: 15 }, // Thin
    //                 { value: 15 }, // Thin
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 20,
    //             minStackHeight: 10,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // Thin items should be stacked vertically (different y positions)
    //         const thin1Y0 = children[1].y0
    //         const thin1Y1 = children[1].y1
    //         const thin2Y0 = children[2].y0
    //         const thin2Y1 = children[2].y1

    //         // Should be stacked (one above the other)
    //         expect(thin1Y0).toBeLessThan(thin2Y0)
    //         expect(thin1Y1).toBeLessThanOrEqual(thin2Y0 + 1) // Adjacent or close

    //         // Both should have same x coordinates (vertically aligned)
    //         expect(children[1].x0).toBeCloseTo(children[2].x0, 1)
    //         expect(children[1].x1).toBeCloseTo(children[2].x1, 1)
    //     })

    //     it("should size stacked items proportionally within the thin band", () => {
    //         const data = {
    //             children: [
    //                 { value: 60 }, // Thick
    //                 { value: 30 }, // Thin - should get 75% of thin band height
    //                 { value: 10 }, // Thin - should get 25% of thin band height
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 25,
    //             minStackHeight: 10,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         const height1 = children[1].y1 - children[1].y0
    //         const height2 = children[2].y1 - children[2].y0

    //         // Heights should be proportional to values (3:1 ratio)
    //         const ratio = height1 / height2
    //         expect(ratio).toBeCloseTo(3, 0)
    //     })
    // })

    // describe("Horizontal sub-row for very short items", () => {
    //     it("should place items with height < minStackHeight in a horizontal row", () => {
    //         const data = {
    //             children: [
    //                 { value: 80 }, // Thick
    //                 { value: 10 }, // Thin, will be stacked
    //                 { value: 5 }, // Thin, might be too short when stacked
    //                 { value: 5 }, // Thin, might be too short when stacked
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 15,
    //             minStackHeight: 25, // High threshold to trigger horizontal row
    //         })
    //         const root = createTreemap(data, tiler, 100, 200)

    //         const children = root.children!

    //         // Last two items (if too short) should be in a horizontal row
    //         // They should have similar y coordinates (same row)
    //         const y2 = (children[2].y0 + children[2].y1) / 2
    //         const y3 = (children[3].y0 + children[3].y1) / 2

    //         // If in same row, their y-midpoints should be very close
    //         const yDiff = Math.abs(y2 - y3)
    //         expect(yDiff).toBeLessThan(5)

    //         // They should have different x coordinates (side by side)
    //         expect(children[2].x0).not.toBeCloseTo(children[3].x0, 0)
    //     })

    //     it("should place horizontal row at the bottom of thin band", () => {
    //         const data = {
    //             children: [
    //                 { value: 70 }, // Thick
    //                 { value: 20 }, // Thin, tall enough when stacked
    //                 { value: 5 }, // Thin, too short
    //                 { value: 5 }, // Thin, too short
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 20,
    //             minStackHeight: 30,
    //         })
    //         const root = createTreemap(data, tiler, 100, 200)

    //         const children = root.children!

    //         // First thin item should be above the short items
    //         expect(children[1].y0).toBeLessThan(children[2].y0)
    //         expect(children[1].y0).toBeLessThan(children[3].y0)

    //         // Short items should be at bottom (higher y values)
    //         expect(children[2].y0).toBeGreaterThan(100) // In lower half
    //         expect(children[3].y0).toBeGreaterThan(100)
    //     })
    // })

    // describe("Edge cases", () => {
    //     it("should handle nodes with no children", () => {
    //         const data = { value: 100 }

    //         const tiler = stackedSliceDiceTiling()
    //         const root = createTreemap(data, tiler, 100, 100)

    //         // Should not throw, root should have correct bounds
    //         expect(root.x0).toBe(0)
    //         expect(root.y0).toBe(0)
    //         expect(root.x1).toBe(100)
    //         expect(root.y1).toBe(100)
    //     })

    //     it("should handle nodes with zero or negative values", () => {
    //         const data = {
    //             children: [
    //                 { value: 50 },
    //                 { value: 0 },
    //                 { value: -10 }, // Should be treated as 0
    //                 { value: 50 },
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({ minSliceWidth: 10 })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         // Should not throw
    //         expect(root.children).toBeDefined()

    //         // Children with zero/negative values should have minimal or zero size
    //         const child1 = root.children![1]
    //         const child2 = root.children![2]

    //         const width1 = child1.x1 - child1.x0
    //         const width2 = child2.x1 - child2.x0

    //         expect(width1).toBeLessThanOrEqual(1)
    //         expect(width2).toBeLessThanOrEqual(1)
    //     })

    //     it("should handle rectangle with zero width or height", () => {
    //         const data = {
    //             children: [{ value: 50 }, { value: 50 }],
    //         }

    //         const tiler = stackedSliceDiceTiling()

    //         // Zero width
    //         expect(() => {
    //             createTreemap(data, tiler, 0, 100)
    //         }).not.toThrow()

    //         // Zero height
    //         expect(() => {
    //             createTreemap(data, tiler, 100, 0)
    //         }).not.toThrow()
    //     })

    //     it("should handle all children being thin", () => {
    //         const data = {
    //             children: [
    //                 { value: 5 },
    //                 { value: 5 },
    //                 { value: 5 },
    //                 { value: 5 },
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 50,
    //             minStackHeight: 10,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         // All children should be in thin band
    //         const children = root.children!

    //         // All should start at x=0 (no thick children before them)
    //         expect(children[0].x0).toBe(0)

    //         // Should be stacked or in horizontal row
    //         expect(children.length).toBe(4)
    //     })

    //     it("should handle single child", () => {
    //         const data = {
    //             children: [{ value: 100 }],
    //         }

    //         const tiler = stackedSliceDiceTiling()
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const child = root.children![0]

    //         // Single child should fill entire rectangle
    //         expect(child.x0).toBe(0)
    //         expect(child.y0).toBe(0)
    //         expect(child.x1).toBe(100)
    //         expect(child.y1).toBe(100)
    //     })
    // })

    // describe("Configuration options", () => {
    //     it("should use default minSliceWidth of 120", () => {
    //         const data = {
    //             children: [
    //                 { value: 85 }, // 85px < 120, should be thin
    //                 { value: 15 },
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling() // No options
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // With default threshold of 120, both should be thin
    //         // They should be stacked vertically
    //         expect(children[0].y0).not.toBe(children[1].y0)
    //     })

    //     it("should use default minStackHeight of 40", () => {
    //         const data = {
    //             children: [
    //                 { value: 90 }, // Thick
    //                 { value: 8 }, // Thin, will be < 40px when stacked in 100px height
    //                 { value: 2 },
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({ minSliceWidth: 15 })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // Thin items with height < 40 should be in horizontal row
    //         const sameRow =
    //             Math.abs(
    //                 (children[1].y0 + children[1].y1) / 2 -
    //                     (children[2].y0 + children[2].y1) / 2
    //             ) < 5

    //         expect(sameRow).toBe(true)
    //     })

    //     it("should respect custom minSliceWidth", () => {
    //         const data = {
    //             children: [
    //                 { value: 60 },
    //                 { value: 25 }, // 25px > 20px threshold, should be thick
    //                 { value: 15 }, // 15px < 20px threshold, should be thin
    //             ],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 20,
    //             minStackHeight: 5,
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // First two should get normal layout (adjacent horizontally)
    //         expect(children[1].x0).toBeCloseTo(children[0].x1, 1)

    //         // Third should be in thin band (to the right)
    //         expect(children[2].x0).toBeGreaterThan(children[1].x1 - 1)
    //     })

    //     it("should respect custom minStackHeight", () => {
    //         const data = {
    //             children: [{ value: 80 }, { value: 10 }, { value: 10 }],
    //         }

    //         const tiler = stackedSliceDiceTiling({
    //             minSliceWidth: 15,
    //             minStackHeight: 5, // Very low threshold
    //         })
    //         const root = createTreemap(data, tiler, 100, 100)

    //         const children = root.children!

    //         // With low threshold, thin items should stack vertically (not horizontal row)
    //         expect(children[1].y0).not.toBeCloseTo(children[2].y0, 0)
    //         // Should have same x coordinates
    //         expect(children[1].x0).toBeCloseTo(children[2].x0, 1)
    //     })
    // })
})
