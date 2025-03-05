/**
 * @vitest-environment jsdom
 */

import { expect, it, describe, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { ExplorerCreatePage } from "./ExplorerCreatePage.js"

describe(ExplorerCreatePage, () => {
    it("renders", () => {
        render(
            <ExplorerCreatePage
                slug={"sample"}
                gitCmsBranchName={"dev"}
                doNotFetch={true}
            />
        )

        // Check for loading indicator
        expect(screen.getByTestId("loading-indicator")).toBeInTheDocument()
    })
})
