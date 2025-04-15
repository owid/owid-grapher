import shell from "shelljs"

interface ExecReturn {
    code: number
    stdout: string
    stderr: string
}

export class ExecError extends Error implements ExecReturn {
    code: number
    stdout: string
    stderr: string

    constructor(props: ExecReturn) {
        super(props.stderr)
        this.code = props.code
        this.stdout = props.stdout
        this.stderr = props.stderr
    }
}

export const execWrapper = (
    command: string,
    options?: shell.ExecOptions
): Promise<ExecReturn> =>
    new Promise((resolve, reject) => {
        shell.exec(command, options || {}, (code, stdout, stderr) =>
            code === 0
                ? resolve({ code, stdout, stderr })
                : reject(new ExecError({ code, stdout, stderr }))
        )
    })
