import { exec } from "tinyexec"

interface ExecReturn {
    exitCode: number | undefined
    stdout: string
    stderr: string
}

export class ExecError extends Error implements ExecReturn {
    exitCode: number | undefined
    stdout: string
    stderr: string

    constructor(props: ExecReturn) {
        super(props.stderr)
        this.exitCode = props.exitCode
        this.stdout = props.stdout
        this.stderr = props.stderr
    }
}

export const execWrapper = async (
    command: string,
    args?: string[]
): Promise<ExecReturn> => {
    const proc = exec(command, args, { nodeOptions: { shell: true } })
    const result = await proc
    if (result.exitCode === 0) {
        return result
    } else {
        throw new ExecError(result)
    }
}
