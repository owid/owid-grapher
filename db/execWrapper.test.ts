import { expect, it, describe } from "vitest"

import { ExecError, execWrapper } from "./execWrapper.js"

describe("execWrapper()", () => {
    it("should resolve when there is a zero exit code", async () => {
        const result = await execWrapper(`echo "it works"; exit 0`, {
            silent: true,
        })
        expect(result).toEqual({
            code: 0,
            stdout: "it works\n",
            stderr: "",
        })
    })

    it("should reject when there is a non-zero exit code", async () => {
        try {
            await execWrapper(`echo "begin"; echo "fail" 1>&2; exit 1`, {
                silent: true,
            })
        } catch (err) {
            expect(err).toBeInstanceOf(ExecError)
            if (err instanceof ExecError) {
                expect(err.code).toEqual(1)
                expect(err.stdout).toEqual("begin\n")
                expect(err.stderr).toEqual("fail\n")
            }
        } finally {
            expect.assertions(4)
        }
    })
})
