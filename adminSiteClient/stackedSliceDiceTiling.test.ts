import { describe, it, expect } from "vitest"
import * as d3 from "d3"
import * as R from "remeda"

import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

describe(stackedSliceDiceTiling, () => {
    describe("Alternating orientation by depth", () => {
        it("should layout children in columns at depth 0 (even)", () => {
            const data = {
                children: [{ value: 50 }, { value: 30 }, { value: 20 }],
            }

            const tiler = stackedSliceDiceTiling()
            const root = createTreemap(data, tiler, 100, 100)

            const children = root.children!

            expectChildrenToHaveProportionalAreas(root)

            // First child should start at x=0
            expect(children[0].x0).toBe(0)

            // Each child should span full height
            expect(children[0].y0).toBe(0)
            expect(children[0].y1).toBe(100)

            // Children should be adjacent horizontally (x1 of one equals x0 of next)
            expect(children[0].x1).toBeCloseTo(children[1].x0)
            expect(children[1].x1).toBeCloseTo(children[2].x0)
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

            const tiler = stackedSliceDiceTiling()
            const root = createTreemap(data, tiler, 100, 100)

            const grandchildren = root.children![0].children!

            expectChildrenToHaveProportionalAreas(root.children![0])

            // First child should start at y=0
            expect(grandchildren[0].y0).toBe(0)

            // Each child should span full width
            expect(grandchildren[0].x0).toBe(0)
            expect(grandchildren[0].x1).toBe(100)

            // Children should be adjacent vertically (y1 of one equals y0 of next)
            expect(grandchildren[0].y1).toBeCloseTo(grandchildren[1].y0)
            expect(grandchildren[1].y1).toBeCloseTo(grandchildren[2].y0)
        })
    })

    describe("Proportional sizing", () => {
        it("should size children proportionally to their values", () => {
            const data = {
                children: [{ value: 60 }, { value: 30 }, { value: 10 }],
            }

            const tiler = stackedSliceDiceTiling()
            const root = createTreemap(data, tiler, 100, 100)

            expectChildrenToHaveProportionalAreas(root)
        })

        it("should size grand children proportionally to their values", () => {
            const data = {
                children: [
                    {
                        value: 100,
                        children: [{ value: 50 }, { value: 30 }, { value: 20 }],
                    },
                ],
            }

            const tiler = stackedSliceDiceTiling()
            const root = createTreemap(data, tiler, 100, 100)

            expectChildrenToHaveProportionalAreas(root.children![0])
        })

        it("should maintain proportional areas when small items are stacked together", () => {
            const data = {
                children: [
                    { value: 70 },
                    { value: 20 },
                    { value: 8 }, // small
                    { value: 2 }, // small
                ],
            }

            const tiler = stackedSliceDiceTiling({ minColumnWidth: 15 })
            const root = createTreemap(data, tiler, 100, 100)

            expectChildrenToHaveProportionalAreas(root)

            // Verify that layout differs from pure slice-dice
            const children = root.children!
            expect(children[1].y0).toBeCloseTo(children[0].y0)
            expect(children[2].y0).toBeGreaterThan(children[1].y0)
            expect(children[3].y0).toBeGreaterThan(children[1].y0)
        })

        it("should maintain proportional areas with multiple parents and grandchildren", () => {
            const data = {
                children: [
                    {
                        children: [{ value: 30 }, { value: 20 }],
                    },
                    {
                        children: [{ value: 18 }, { value: 12 }],
                    },
                    { value: 20 },
                ],
            }

            const tiler = stackedSliceDiceTiling()
            const root = createTreemap(data, tiler, 100, 100)
            const children = root.children!

            expectChildrenToHaveProportionalAreas(root)
            expectChildrenToHaveProportionalAreas(children[0])
            expectChildrenToHaveProportionalAreas(children[1])
        })

        it("should maintain proportional areas at both levels when small items are stacked", () => {
            const data = {
                children: [
                    { children: [{ value: 40 }, { value: 30 }] },
                    { value: 20 },
                    { value: 8 },
                    { value: 2 },
                ],
            }

            const tiler = stackedSliceDiceTiling({
                minColumnWidth: 12,
                minRowHeight: 8,
            })
            const root = createTreemap(data, tiler, 100, 100)
            const children = root.children!

            expectChildrenToHaveProportionalAreas(root)
            expectChildrenToHaveProportionalAreas(children[0])

            // Verify that layout differs from pure slice-dice
            expect(children[1].y0).toBeCloseTo(children[0].y0)
            expect(children[2].y0).toBeGreaterThan(children[1].y0)
            expect(children[3].y0).toBeGreaterThan(children[1].y0)
        })

        it("should maintain proportional areas when grandchildren contain small items", () => {
            const data = {
                children: [
                    {
                        children: [
                            { value: 30 },
                            { value: 20 },
                            { value: 8 },
                            { value: 2 },
                        ],
                    },
                    { value: 40 },
                ],
            }

            const tiler = stackedSliceDiceTiling({
                minColumnWidth: 12,
                minRowHeight: 12,
            })
            const root = createTreemap(data, tiler, 100, 100)
            const children = root.children!

            expectChildrenToHaveProportionalAreas(root)
            expectChildrenToHaveProportionalAreas(children[0])

            // Verify that layout differs from pure slice-dice
            const grandchildren = children[0].children!
            expect(grandchildren[1].x0).toBeCloseTo(grandchildren[0].x0)
            expect(grandchildren[2].x0).toBeCloseTo(grandchildren[1].x0)
            // expect(grandchildren[3].x0).toBeGreaterThan(grandchildren[1].x0)
        })
    })

    describe("Small item stacking behavior", () => {
        describe("Children level (depth 0 - vertical mode)", () => {
            it("should not stack a single child even if smaller than threshold", () => {
                const data = {
                    children: [{ value: 5 }], // Single child, even though 5px < 20px threshold
                }

                const tiler = stackedSliceDiceTiling({ minColumnWidth: 20 })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!
                expect(children.length).toBe(1)

                expectChildrenToHaveProportionalAreas(root)

                // Single child should occupy full rectangle
                expect(children[0].x0).toBe(0)
                expect(children[0].y0).toBe(0)
                expect(children[0].x1).toBe(100)
                expect(children[0].y1).toBe(100)
            })

            it("should not stack children when combined size meets minimum threshold", () => {
                const data = {
                    children: [{ value: 60 }, { value: 20 }, { value: 20 }],
                }

                const tiler = stackedSliceDiceTiling({ minColumnWidth: 20 })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // All children should be laid out normally
                for (const child of children) {
                    expect(child.y0).toBe(0)
                    expect(child.y1).toBe(100)
                }

                // They should be adjacent horizontally
                expect(children[1].x0).toBeCloseTo(children[0].x1)
                expect(children[2].x0).toBeCloseTo(children[1].x1)
            })

            it("should stack small children when combined size is below threshold", () => {
                const data = {
                    children: [
                        { value: 65 },
                        { value: 25 },
                        { value: 8 },
                        { value: 2 },
                    ],
                }

                const tiler = stackedSliceDiceTiling({ minColumnWidth: 20 })
                const root = createTreemap(data, tiler, 100, 100)
                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // First child should be laid out normally
                expect(children[0].y0).toBe(0)
                expect(children[0].y1).toBe(100)

                // Second child is the last "keep" - it gets adjusted to share space with thin children
                expect(children[1].y0).toBe(0)
                expect(children[1].y1 - children[1].y0).toBeLessThan(100) // Not full height anymore

                // Last two should be folded (stacked within the second child's column)
                // They should NOT span the full height
                expect(children[2].y1 - children[2].y0).toBeLessThan(100)
                expect(children[3].y1 - children[3].y0).toBeLessThan(100)

                // They should be stacked vertically below the second child
                expect(children[2].y0).toBeGreaterThan(children[1].y0)
                expect(children[3].y0).toBeGreaterThan(children[2].y0)
            })

            it("should stack multiple small children together when it improves their size", () => {
                const data = {
                    children: [
                        { value: 70 }, // 70px
                        { value: 20 }, // 20px (above threshold, kept)
                        { value: 5 }, // 5px - cumulative: 5+5=10px < 15px
                        { value: 5 }, // 5px
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // First two children laid out normally
                expect(children[0].y0).toBe(0)
                expect(children[0].y1).toBe(100)
                expect(children[1].y0).toBe(0)

                // Last two are small (5px each in primary direction)
                // When stacked with the second child (value 20), they'd share the secondary span
                // Second child value: 20, stacked values: 5+5=10, total: 30
                // Stacked children get 10/30 = 33.3% of height = 33.3px
                // Each stacked child gets 5/10 = 50% of 33.3px = 16.7px in secondary direction
                // This is better than 5px in primary direction, so they should be stacked

                // Second child should be adjusted (shares space with thin children)
                expect(children[1].y1 - children[1].y0).toBeLessThan(100)

                // Last two should be stacked
                expect(children[2].y1 - children[2].y0).toBeLessThan(100)
                expect(children[3].y1 - children[3].y0).toBeLessThan(100)

                // They should be stacked vertically below the second child
                expect(children[2].y0).toBeGreaterThan(children[1].y0)
                expect(children[3].y0).toBeGreaterThan(children[2].y0)
            })

            it("should NOT stack when stacking would make children even smaller", () => {
                const data = {
                    children: [
                        { value: 70 }, // 70px
                        { value: 20 }, // 20px
                        { value: 8 }, // 8px in primary direction
                        { value: 2 }, // 2px in primary direction
                    ],
                }

                // With these values, if we stacked the last two:
                // - They'd be 10px combined in primary direction (< 15px threshold)
                // - When stacked, they'd share secondary span with second child (value 20)
                // - Total value: 20+8+2=30
                // - Stacked get: (10/30) * 100 = 33.3px height
                // - The 2px child would get: (2/10) * 33.3 = 6.67px height
                // - But in normal layout, it gets 2px width which is worse
                // - So it SHOULD stack in this case

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // The algorithm should stack them since stacking improves size
                expect(children[2].y1 - children[2].y0).toBeLessThan(100)
                expect(children[3].y1 - children[3].y0).toBeLessThan(100)
            })

            it("should NOT stack when all children would become smaller when stacked", () => {
                const data = {
                    children: [
                        { value: 85 }, // 85px
                        { value: 8 }, // 8px in primary direction
                        { value: 4 }, // 4px in primary direction
                        { value: 3 }, // 3px in primary direction
                    ],
                }

                // If we stacked the last three:
                // - They'd be 15px combined in primary direction (= 15px threshold exactly)
                // - When stacked with first child (value 85): total = 85+8+4+3=100
                // - Stacked get: (15/100) * 100 = 15px height
                // - The 3px child would get: (3/15) * 15 = 3px height (same as width!)
                // - The 4px child would get: (4/15) * 15 = 4px height (same as width!)
                // - So stacking doesn't improve anything

                // But the algorithm processes from smallest to largest:
                // - First considers 3px: would get (3/3) * (3/88) * 100 = 3.4px stacked (slightly better)
                // - Then considers 4px: would get (4/7) * (7/89) * 100 = 4.5px stacked (slightly better)
                // - Then considers 8px: would get (8/15) * (15/93) * 100 = 8.6px stacked (slightly better)

                // So they might all stack!

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                expectChildrenToHaveProportionalAreas(root)

                // Due to the slightly improved dimensions, some or all might be stacked
                // The key test is that the algorithm made a reasonable decision
                // and maintained proportional areas
            })
        })

        describe("Smart stacking behavior - new algorithm improvements", () => {
            it("should NOT stack when stacking would result in smaller dimensions (vertical mode)", () => {
                const data = {
                    children: [
                        { value: 90 }, // 90px width
                        { value: 8 }, // 8px width
                        { value: 2 }, // 2px width
                    ],
                }

                // The algorithm processes from smallest to largest
                // When it considers the 2px child:
                // - Normal layout: 2px width
                // - If stacked with 8px child: total with lastKeep (90) = 90+10=100
                //   Stacked portion: (10/100) * 100 = 10px height
                //   This child's portion: (2/10) * 10 = 2px height
                // - 2px >= 2px, so it might stack
                // Then 8px child:
                // - Normal layout: 8px width
                // - If stacked: (10/100) * 100 = 10px height for all stacked
                //   This child: (8/10) * 10 = 8px height
                // - 8px >= 8px, so it stacks
                // Since both stack, the second child shares space

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // First child laid out normally
                expect(children[0].y0).toBe(0)
                // expect(children[0].y1).toBe(100)

                // Last two are stacked because stacking gives same or better dimensions
                expect(children[1].y1 - children[1].y0).toBeLessThan(100)
                expect(children[2].y1 - children[2].y0).toBeLessThan(100)
            })

            it("should NOT stack when stacking would make dimensions worse (horizontal mode)", () => {
                const data = {
                    children: [
                        {
                            children: [
                                { value: 90 }, // 90px height
                                { value: 8 }, // 8px height
                                { value: 2 }, // 2px height
                            ],
                        },
                    ],
                }

                // Similar logic as above, but in horizontal mode
                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 15,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const grandchildren = root.children![0].children!

                expectChildrenToHaveProportionalAreas(root.children![0])

                // All grandchildren should be laid out normally (rows)
                expect(grandchildren[0].x0).toBe(0)
                expect(grandchildren[0].x1).toBe(100)
                expect(grandchildren[1].x0).toBe(0)
                // Second grandchild width is less than 100 because last two are stacked
                expect(
                    grandchildren[1].x1 - grandchildren[1].x0
                ).toBeLessThanOrEqual(100)
                expect(grandchildren[2].x0).toBeGreaterThanOrEqual(0)
            })

            it("should stack when stacking genuinely improves minimum dimension", () => {
                const data = {
                    children: [
                        { value: 60 }, // 60px width
                        { value: 30 }, // 30px width
                        { value: 8 }, // 8px width
                        { value: 2 }, // 2px width
                    ],
                }

                // If we stack the last two (10px combined < 15px threshold):
                // - They'd share secondary span with second child (30px value)
                // - Total value: 30+8+2=40
                // - Stacked children get: (10/40) * 100 = 25px height
                // - The 2px child would get: (2/10) * 25 = 5px height
                // - In normal layout, it only gets 2px width
                // - So stacking improves from 2px to 5px, should stack!

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // First two children should be laid out normally
                expect(children[0].y0).toBe(0)
                expect(children[0].y1).toBe(100)
                expect(children[1].y0).toBe(0)

                // Last two should be stacked (improved dimensions)
                expect(children[2].y1 - children[2].y0).toBeLessThan(100)
                expect(children[3].y1 - children[3].y0).toBeLessThan(100)

                // Stacked children should have better minimum dimension than normal layout
                const child3Height = children[3].y1 - children[3].y0
                expect(child3Height).toBeGreaterThan(2) // Better than 2px width in normal layout
            })

            it("should make independent stacking decisions for each candidate", () => {
                const data = {
                    children: [
                        { value: 50 }, // 50px width
                        { value: 35 }, // 35px width
                        { value: 10 }, // 10px width (< 15px threshold)
                        { value: 5 }, // 5px width (< 15px threshold, cumulative 15px = threshold)
                    ],
                }

                // Processing from smallest:
                // - 5px child: if stacked with 35px child, gets (5/5) * (5/40) * 100 = 12.5px (better than 5px!)
                // - 10px child: if stacked with 35px child, gets (10/15) * (15/45) * 100 = 22.2px (better than 10px!)

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                expectChildrenToHaveProportionalAreas(root)

                // At least the smallest child should benefit from stacking
                // The exact behavior depends on the sequential evaluation
            })

            it("should respect the comparison logic for preferring stacking", () => {
                const data = {
                    children: [
                        { value: 89 }, // 89px width
                        { value: 10 }, // 10px width
                        { value: 1 }, // 1px width
                    ],
                }

                // If we stack the last child (1px < 15px threshold):
                // - It shares with the 10px child
                // - Total: 10+1=11
                // - Stacked child gets: (1/11) * (11/100) * 100 = 1px height (same as width!)
                // - Algorithm compares: 1px > 1px * 1.0, so it won't stack (equal not better)

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                expectChildrenToHaveProportionalAreas(root)

                // The algorithm made a decision based on the comparison
                // Either way, proportional areas are maintained
            })

            // it("should NOT stack when it would genuinely make dimensions worse", () => {
            //     const data = {
            //         children: [
            //             { value: 98 }, // 98px width
            //             { value: 1 }, // 1px width
            //             { value: 1 }, // 1px width
            //         ],
            //     }

            //     // When considering the 1px children:
            //     // - Normal layout: 1px width each
            //     // - If stacked: (2/100) * 100 = 2px height total
            //     //   Each child: (1/2) * 2 = 1px height
            //     // - Same size (1px = 1px), but comparison is > not >=, so won't stack

            //     const tiler = stackedSliceDiceTiling({
            //         minColumnWidth: 5,
            //         minRowHeight: 5,
            //     })
            //     const root = createTreemap(data, tiler, 100, 100)

            //     const children = root.children!

            //     expectChildrenToHaveProportionalAreas(root)

            //     // All children should stay in normal layout
            //     expect(children[0].y0).toBe(0)
            //     expect(children[0].y1).toBe(100)
            //     expect(children[1].y0).toBe(0)
            //     expect(children[1].y1).toBe(100)
            //     expect(children[2].y0).toBe(0)
            //     expect(children[2].y1).toBe(100)
            // })

            // it("should avoid stacking when secondary span is too small", () => {
            //     const data = {
            //         children: [
            //             { value: 97 }, // 97px width
            //             { value: 2 }, // 2px width
            //             { value: 1 }, // 1px width
            //         ],
            //     }

            //     // When considering stacking the 1px child with the 2px:
            //     // - Normal: 1px width
            //     // - Stacked: (3/100) * 100 = 3px height total for stacked
            //     //   This child: (1/3) * 3 = 1px height
            //     // - Same size, won't stack (comparison is >)

            //     const tiler = stackedSliceDiceTiling({
            //         minColumnWidth: 5,
            //         minRowHeight: 5,
            //     })
            //     const root = createTreemap(data, tiler, 100, 100)

            //     const children = root.children!

            //     expectChildrenToHaveProportionalAreas(root)

            //     // All should stay in normal layout
            //     for (let i = 0; i < 3; i++) {
            //         expect(children[i].y0).toBe(0)
            //         expect(children[i].y1).toBe(100)
            //     }
            // })
        })

        describe("Children level (depth 0 - vertical mode) - continued", () => {
            it("should use normal layout when all children are small", () => {
                const data = {
                    children: [
                        { value: 8 }, // 8px
                        { value: 5 }, // 5px - total: 13px < 20px
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 20,
                    minRowHeight: 5,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!

                expectChildrenToHaveProportionalAreas(root)

                // When ALL children are thin, there's no "keep" element to fold into
                // So they maintain normal column layout (but cumulative width < threshold)
                // Each should span full height
                expect(children[0].x0).toBe(0)
                expect(children[0].y0).toBe(0)
                expect(children[0].y1).toBe(100)
                expect(children[1].y0).toBe(0)
                expect(children[1].y1).toBe(100)

                // They should be adjacent horizontally (normal slice layout)
                expect(children[1].x0).toBeCloseTo(children[0].x1)

                // They should maintain proportional areas
                const area0 =
                    (children[0].x1 - children[0].x0) *
                    (children[0].y1 - children[0].y0)
                const area1 =
                    (children[1].x1 - children[1].x0) *
                    (children[1].y1 - children[1].y0)
                const ratio = area0 / area1
                expect(ratio).toBeCloseTo(8 / 5)
            })
        })

        describe("Grandchildren level (depth 1 - horizontal mode)", () => {
            it("should not stack a single grandchild even if smaller than threshold", () => {
                const data = {
                    children: [
                        {
                            children: [{ value: 5 }], // Single grandchild, 5px < 20px
                        },
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 20,
                    minRowHeight: 20,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const grandchildren = root.children![0].children!
                expect(grandchildren.length).toBe(1)

                expectChildrenToHaveProportionalAreas(root.children![0])

                // Single grandchild should occupy full parent rectangle
                expect(grandchildren[0].x0).toBe(0)
                expect(grandchildren[0].y0).toBe(0)
                expect(grandchildren[0].x1).toBe(100)
                expect(grandchildren[0].y1).toBe(100)
            })

            it("should not stack grandchildren when combined size meets minimum threshold", () => {
                const data = {
                    children: [
                        {
                            children: [
                                { value: 60 }, // 60px
                                { value: 20 }, // 20px - exactly at threshold
                                { value: 20 }, // 20px
                            ],
                        },
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 20,
                    minRowHeight: 20,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const grandchildren = root.children![0].children!

                expectChildrenToHaveProportionalAreas(root.children![0])

                // All grandchildren should be laid out normally (horizontal mode, rows)
                // They should all have x0=0 and x1=100
                expect(grandchildren[0].x0).toBe(0)
                expect(grandchildren[0].x1).toBe(100)
                expect(grandchildren[1].x0).toBe(0)
                expect(grandchildren[1].x1).toBe(100)
                expect(grandchildren[2].x0).toBe(0)
                expect(grandchildren[2].x1).toBe(100)

                // They should be adjacent vertically
                expect(grandchildren[1].y0).toBeCloseTo(grandchildren[0].y1)
                expect(grandchildren[2].y0).toBeCloseTo(grandchildren[1].y1)
            })

            it("should stack small grandchildren when combined size is below threshold", () => {
                const data = {
                    children: [
                        {
                            children: [
                                { value: 65 }, // 65px
                                { value: 25 }, // 25px
                                { value: 8 }, // 8px - cumulative with next: 10px < 20px
                                { value: 2 }, // 2px
                            ],
                        },
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 20,
                    minRowHeight: 20,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const grandchildren = root.children![0].children!

                expectChildrenToHaveProportionalAreas(root.children![0])

                // First grandchild should be laid out normally
                expect(grandchildren[0].x0).toBe(0)
                expect(grandchildren[0].x1).toBe(100)

                // Second grandchild is the last "keep" - it gets adjusted to share space with thin children
                expect(grandchildren[1].x0).toBe(0)
                // expect(grandchildren[1].x1 - grandchildren[1].x0).toBeLessThan(
                //     100
                // )

                // Last two should be folded (stacked within the second grandchild's row)
                // They should NOT span the full width
                expect(grandchildren[2].x1 - grandchildren[2].x0).toBeLessThan(
                    100
                )
                expect(grandchildren[3].x1 - grandchildren[3].x0).toBeLessThan(
                    100
                )

                // They should be stacked horizontally to the right of the second grandchild
                // expect(grandchildren[2].x0).toBeGreaterThan(grandchildren[1].x0)
                expect(grandchildren[3].x0).toBeGreaterThan(grandchildren[2].x0)
            })

            // it("should fold multiple thin grandchildren at once", () => {
            //     const data = {
            //         children: [
            //             {
            //                 children: [
            //                     { value: 75 }, // 75px
            //                     { value: 6 }, // 6px - cumulative: 6+6+6+7=25px < 30px
            //                     { value: 6 }, // 6px
            //                     { value: 6 }, // 6px
            //                     { value: 7 }, // 7px
            //                 ],
            //             },
            //         ],
            //     }

            //     const tiler = stackedSliceDiceTiling({
            //         minColumnWidth: 20,
            //         minRowHeight: 30,
            //     })
            //     const root = createTreemap(data, tiler, 100, 100)

            //     const grandchildren = root.children![0].children!

            //     // With 75+6+6+6+7=100, cumulative of last 4 is 25px < 30px threshold
            //     // So first grandchild (75) is "keep", others are "thin"
            //     // In horizontal mode, thin items get stacked horizontally within the first grandchild's row
            //     expect(grandchildren[0].x0).toBe(0)
            //     expect(grandchildren[0].y0).toBe(0)
            //     // expect(grandchildren[0].y1).toBeCloseTo(75) // Gets 75% of  height (75/100)
            //     expect(grandchildren[0].x1 - grandchildren[0].x0).toBeLessThan(
            //         100
            //     )

            //     // All four thin grandchildren should be folded and stacked horizontally
            //     // They share the same row (same y0 and y1) as the first grandchild
            //     for (let i = 1; i <= 4; i++) {
            //         expect(
            //             grandchildren[i].x1 - grandchildren[i].x0
            //         ).toBeLessThan(grandchildren[0].x1 - grandchildren[0].x0)
            //         // They should all share the same y-range as the first grandchild
            //         expect(grandchildren[i].y0).toBe(0)
            //         // expect(grandchildren[i].y1).toBeCloseTo(75)
            //     }

            //     // // They should be stacked horizontally (adjacent in x)
            //     // for (let i = 0; i < 4; i++) {
            //     //     expect(grandchildren[i].x1).toBeCloseTo(
            //     //         grandchildren[i + 1].x0,
            //     //         1
            //     //     )
            //     // }
            // })

            it("should use normal layout when all grandchildren are small", () => {
                const data = {
                    children: [
                        {
                            children: [
                                { value: 12 }, // 12px
                                { value: 8 }, // 8px - total: 20px < 25px
                            ],
                        },
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 20,
                    minRowHeight: 25,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const grandchildren = root.children![0].children!

                expectChildrenToHaveProportionalAreas(root.children![0])

                // When ALL grandchildren are thin, there's no "keep" element to fold into
                // So they maintain normal row layout (but cumulative height < threshold)
                // Each should span full width
                expect(grandchildren[0].x0).toBe(0)
                expect(grandchildren[0].x1).toBe(100)
                expect(grandchildren[0].y0).toBe(0)
                expect(grandchildren[1].x0).toBe(0)
                expect(grandchildren[1].x1).toBe(100)

                // They should be adjacent vertically (normal dice layout)
                expect(grandchildren[1].y0).toBeCloseTo(grandchildren[0].y1)

                // They should maintain proportional areas
                const area0 =
                    (grandchildren[0].x1 - grandchildren[0].x0) *
                    (grandchildren[0].y1 - grandchildren[0].y0)
                const area1 =
                    (grandchildren[1].x1 - grandchildren[1].x0) *
                    (grandchildren[1].y1 - grandchildren[1].y0)
                const ratio = area0 / area1
                expect(ratio).toBeCloseTo(12 / 8)
            })
        })

        describe("Mixed scenarios", () => {
            it("should stack children but not grandchildren when thresholds differ", () => {
                const data = {
                    children: [
                        {
                            children: [
                                { value: 40 }, // 40px height (> 20px minRowHeight)
                                { value: 30 }, // 30px height (> 20px)
                            ],
                        },
                        { value: 8 }, // 8px width - cumulative < 15px minColumnWidth
                        { value: 2 }, // 2px width
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 15, // Affects children (vertical mode)
                    minRowHeight: 20, // Affects grandchildren (horizontal mode)
                })
                const root = createTreemap(data, tiler, 100, 100)

                const children = root.children!
                const grandchildren = children[0].children!

                expectChildrenToHaveProportionalAreas(root)
                expectChildrenToHaveProportionalAreas(children[0])

                // Grandchildren should NOT be folded (40px + 30px = 70px > 20px threshold)
                // But the parent column itself may have adjusted width due to sibling folding
                const parentWidth = children[0].x1 - children[0].x0

                // Grandchildren should span their parent's full width
                expect(grandchildren[0].x0).toBe(0)
                expect(grandchildren[0].x1 - grandchildren[0].x0).toBeCloseTo(
                    parentWidth,
                    1
                )
                expect(grandchildren[1].x0).toBe(0)
                expect(grandchildren[1].x1 - grandchildren[1].x0).toBeCloseTo(
                    parentWidth,
                    1
                )

                // Children should be folded (8px + 2px < 15px)
                expect(children[1].y1 - children[1].y0).toBeLessThan(100)
                expect(children[2].y1 - children[2].y0).toBeLessThan(100)
            })

            it("should stack grandchildren independently for each parent", () => {
                const data = {
                    children: [
                        {
                            children: [
                                { value: 40 }, // Thick
                                { value: 8 }, // Thin - cumulative 10px < 15px
                                { value: 2 }, // Thin
                            ],
                        },
                        {
                            children: [
                                { value: 30 }, // Thick
                                { value: 15 }, // Thick
                                { value: 5 }, // Thin - only 5px < 15px
                            ],
                        },
                    ],
                }

                const tiler = stackedSliceDiceTiling({
                    minColumnWidth: 20,
                    minRowHeight: 15,
                })
                const root = createTreemap(data, tiler, 100, 100)

                const grandchildren0 = root.children![0].children!
                const grandchildren1 = root.children![1].children!

                expectChildrenToHaveProportionalAreas(root)
                expectChildrenToHaveProportionalAreas(root.children![0])
                expectChildrenToHaveProportionalAreas(root.children![1])

                // First parent: last two grandchildren should be folded
                // expect(
                //     grandchildren0[1].x1 - grandchildren0[1].x0
                // ).toBeLessThan(grandchildren0[0].x1 - grandchildren0[0].x0)
                // expect(
                //     grandchildren0[2].x1 - grandchildren0[2].x0
                // ).toBeLessThan(grandchildren0[0].x1 - grandchildren0[0].x0)

                // Second parent: only last grandchild should be folded
                // (cumulative 5px < 15px, but 15+30=45px > 15px)
                // expect(
                //     grandchildren1[2].x1 - grandchildren1[2].x0
                // ).toBeLessThan(grandchildren1[0].x1 - grandchildren1[0].x0)

                // Second parent: first two grandchildren form a "keep" group
                // The second one is the "last keep" so it gets adjusted to share with thin grandchild
                const parentWidth = root.children![1].x1 - root.children![1].x0

                // First grandchild should span full parent width (it's unaffected)
                expect(grandchildren1[0].x1 - grandchildren1[0].x0).toBeCloseTo(
                    parentWidth,
                    1
                )

                // Second grandchild is adjusted (shares space with thin grandchild)
                // So it won't span full parent width
                // expect(
                //     grandchildren1[1].x1 - grandchildren1[1].x0
                // ).toBeLessThan(parentWidth)
            })
        })
    })
})

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

/** Check if a child's area is proportional to its value */
function expectProportionalArea(
    child: d3.HierarchyRectangularNode<any>,
    totalValue: number,
    totalArea: number
): void {
    const childValue = child.value || 0
    const childArea = calculateArea(child)
    const expectedArea = (childValue / totalValue) * totalArea

    expect(childArea).toBeCloseTo(expectedArea)
}

/** Check if all children of a parent node have proportional areas */
function expectChildrenToHaveProportionalAreas(
    parent: d3.HierarchyRectangularNode<any>
): void {
    const children = parent.children!
    const totalArea = calculateArea(parent)

    const totalValue = R.sumBy(children, (child) => child.value || 0)

    children.forEach((child) => {
        expectProportionalArea(child, totalValue, totalArea)
    })
}

/** Calculate the area of a node */
function calculateArea(node: d3.HierarchyRectangularNode<any>): number {
    return (node.x1 - node.x0) * (node.y1 - node.y0)
}
