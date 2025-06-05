import tests from "./ab-tests.json" with { type: "json" }
// todo: send GA paramaters with all events, listing all experimental arms/conditions

export const abTest = async (context) => {
    const originalResponse = await context.next()
    const cookie = context.request.headers.get("cookie")

    if (tests && tests.length) {
        let anyTrt = false
        tests.map((test) => {
            if (!cookie || !cookie.includes(test["id"])) {
                // todo: what if cumul doesn't sum to 1?
                let cumul = 0
                test["arms"].map((arm) => {
                    cumul += arm["size"]
                    arm["cumulSize"] = cumul
                })
                // assign visitor to an experimental arm
                const percentage = Math.random()
                let assignedArm
                for (const arm of test["arms"]) {
                    const assignToArm =
                        arm["cumulSize"] - arm["size"] <= percentage &&
                        percentage < arm["cumulSize"]
                    if (assignToArm) {
                        assignedArm = arm["id"]
                        break
                    }
                }
                const expiresAt = test["expires"]
                    ? new Date(test["expires"])
                    : new Date(Date.now() + 7 * (24 * 60 * 60 * 1000)) // fallback: expires in 7 days
                if (assignedArm) {
                    originalResponse.headers.append(
                        "Set-Cookie",
                        `${test["id"]}=${assignedArm}; expires=${expiresAt.toUTCString()}; path=/grapher/`
                    )
                    if (assignedArm !== "ctl") {
                        anyTrt = true
                    }
                }
            }
        })
        if (anyTrt) {
            // todo: if user has accepted cookies, record this session replay
        }
        return originalResponse
    }

    return originalResponse
}
