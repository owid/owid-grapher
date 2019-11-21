import * as React from "react"
import { Admin } from "./Admin"

export interface AdminAppContextType {
    admin: Admin
}

const AdminAppContext: React.Context<AdminAppContextType> = React.createContext(
    {}
) as any
export { AdminAppContext }
