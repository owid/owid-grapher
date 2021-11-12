export type OpPatch =
    | AddPatch
    | RemovePatch
    | ReplacePatch
    | MovePatch
    | CopyPatch
    | TestPatch
export interface Patch {
    path: string
}
export interface AddPatch extends Patch {
    op: "add"
    value: any
}
export interface RemovePatch extends Patch {
    op: "remove"
}
export interface ReplacePatch extends Patch {
    op: "replace"
    value: any
}
export interface MovePatch extends Patch {
    op: "move"
    from: string
}
export interface CopyPatch extends Patch {
    op: "copy"
    from: string
}
export interface TestPatch extends Patch {
    op: "test"
    value: any
}
