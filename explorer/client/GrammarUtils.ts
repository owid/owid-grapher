export const isBlankLine = (line: string[] | undefined) =>
    line === undefined ? true : line.join("") === ""

// Todo: figure out Matrix cell type and whether we need the double check
export const isEmpty = (value: any) => value === "" || value === undefined
