import React from "react"
import { Drawer, IconButton, Box, Typography, Fab } from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import CloseIcon from "@mui/icons-material/Close"

export const DataCatalogSettings = () => {
    const [drawerOpen, setDrawerOpen] = React.useState(false)

    return (
        <>
            <Fab
                color="primary"
                aria-label="settings"
                onClick={() => setDrawerOpen(true)}
                sx={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: 1000,
                }}
            >
                <SettingsIcon />
            </Fab>

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            >
                <Box sx={{ width: 300, p: 3 }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 2,
                        }}
                    >
                        <Typography variant="h6">Settings</Typography>
                        <IconButton onClick={() => setDrawerOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box>{/* Drawer content will go here */}</Box>
                </Box>
            </Drawer>
        </>
    )
}
