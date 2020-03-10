#! /usr/bin/env jest

const { exec } = require("utils/server/serverUtil")

describe("serverUtil", () => {
    describe("exec()", () => {
        it("should resolve when there is a zero exit code", async () => {
            const result = await exec(`echo "it works"; exit 0`, {
                silent: true
            })
            expect(result).toEqual("it works\n")
        })

        it("should reject when there is a non-zero exit code", async () => {
            try {
                await exec(`echo "does not work"; exit 1`, {
                    silent: true
                })
            } catch (err) {
                expect(err).toBeInstanceOf(Error)
            } finally {
                expect.assertions(1)
            }
        })
    })
})
