// https://github.com/testing-library/jest-dom#with-vitest
import "@testing-library/jest-dom/vitest"

// https://testing-library.com/docs/react-testing-library/setup#auto-cleanup-in-vitest
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
    cleanup()
})
