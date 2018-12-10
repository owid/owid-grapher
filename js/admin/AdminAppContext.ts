import * as React from 'react'
import Admin from './Admin'

const AdminAppContext: React.Context<{ admin: Admin }> = React.createContext({}) as any
export { AdminAppContext }