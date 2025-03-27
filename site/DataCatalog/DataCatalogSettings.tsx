import { useState } from "react"
import {
    Drawer,
    Typography,
    List,
    ListItem,
    ListItemText,
    Switch,
    ListSubheader,
    Box,
    Fab,
    IconButton,
} from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import { DEFAULT_COMPONENTS, CatalogComponentId } from "./DataCatalogState"
import ArrowUpward from "@mui/icons-material/ArrowUpward"
import ArrowDownward from "@mui/icons-material/ArrowDownward"

export const DataCatalogSettings = ({
    componentOrder = [],
    componentVisibility,
    updateComponentOrder,
    toggleComponentVisibility,
}: {
    componentOrder?: CatalogComponentId[]
    componentVisibility?: Record<CatalogComponentId, boolean>
    updateComponentOrder?: (order: CatalogComponentId[]) => void
    toggleComponentVisibility?: (id: CatalogComponentId) => void
}) => {
    const [open, setOpen] = useState(false)

    const componentNameMap = Object.fromEntries(
        DEFAULT_COMPONENTS.map((c) => [c.id, c.name])
    )

    const handleMoveUp = (index: number) => {
        if (!updateComponentOrder || index <= 0) return

        const newOrder = [...componentOrder]
        const temp = newOrder[index - 1]
        newOrder[index - 1] = newOrder[index]
        newOrder[index] = temp
        updateComponentOrder(newOrder)
    }

    const handleMoveDown = (index: number) => {
        if (!updateComponentOrder || index >= componentOrder.length - 1) return

        const newOrder = [...componentOrder]
        const temp = newOrder[index + 1]
        newOrder[index + 1] = newOrder[index]
        newOrder[index] = temp
        updateComponentOrder(newOrder)
    }

    return (
        <>
            <Fab
                color="primary"
                aria-label="settings"
                onClick={() => setOpen(true)}
                sx={{ position: "fixed", bottom: 20, right: 20 }}
            >
                <SettingsIcon />
            </Fab>

            <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
                <Box sx={{ width: 300, padding: 2 }}>
                    <Typography variant="h6">Data Catalog Settings</Typography>

                    {updateComponentOrder && toggleComponentVisibility && (
                        <List
                            subheader={
                                <ListSubheader>
                                    Component Order & Visibility
                                </ListSubheader>
                            }
                        >
                            {componentOrder.map((id, index) => (
                                <ListItem
                                    key={id}
                                    secondaryAction={
                                        <Switch
                                            edge="end"
                                            checked={
                                                componentVisibility
                                                    ? componentVisibility[id]
                                                    : false
                                            }
                                            onChange={() =>
                                                toggleComponentVisibility(id)
                                            }
                                        />
                                    }
                                >
                                    <ListItemText
                                        primary={componentNameMap[id] || id}
                                    />
                                    <Box sx={{ marginRight: 2 }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleMoveUp(index)}
                                            disabled={index === 0}
                                        >
                                            <ArrowUpward fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                handleMoveDown(index)
                                            }
                                            disabled={
                                                index ===
                                                componentOrder.length - 1
                                            }
                                        >
                                            <ArrowDownward fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Drawer>
        </>
    )
}
