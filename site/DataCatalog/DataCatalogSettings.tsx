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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider,
    ToggleButtonGroup,
    ToggleButton,
    FormControlLabel,
    Radio,
    RadioGroup,
    FormLabel,
    FormHelperText,
} from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import {
    DEFAULT_COMPONENTS,
    CatalogComponentId,
    CatalogComponentStyle,
    SearchRelaxationMode,
    QueryType,
} from "./DataCatalogState"
import ArrowUpward from "@mui/icons-material/ArrowUpward"
import ArrowDownward from "@mui/icons-material/ArrowDownward"
import ViewListIcon from "@mui/icons-material/ViewList"
import GridViewIcon from "@mui/icons-material/GridView"

export const DataCatalogSettings = ({
    componentOrder = [],
    componentVisibility,
    componentCount,
    componentStyles,
    isStickyHeader,
    searchRelaxationMode,
    queryType,
    typoTolerance,
    minQueryLength,
    requireAllCountries,
    requireAllTags,
    updateComponentOrder,
    toggleComponentVisibility,
    setComponentCount,
    setComponentStyle,
    toggleStickyHeader,
    setSearchRelaxationMode,
    setQueryType,
    setTypoTolerance,
    setMinQueryLength,
    enableCombinedFilters,
    toggleCombinedFilters,
    toggleRequireAllCountries,
    toggleRequireAllTags,
}: {
    componentOrder: CatalogComponentId[]
    componentVisibility: Record<CatalogComponentId, boolean>
    componentCount: Record<CatalogComponentId, number>
    componentStyles: Record<CatalogComponentId, CatalogComponentStyle>
    isStickyHeader: boolean
    searchRelaxationMode: SearchRelaxationMode
    queryType: QueryType
    typoTolerance: boolean
    minQueryLength: number
    requireAllCountries: boolean
    requireAllTags: boolean
    updateComponentOrder: (order: CatalogComponentId[]) => void
    toggleComponentVisibility: (id: CatalogComponentId) => void
    setComponentCount: (id: CatalogComponentId, count: number) => void
    setComponentStyle: (
        id: CatalogComponentId,
        style: CatalogComponentStyle
    ) => void
    toggleStickyHeader: () => void
    setSearchRelaxationMode: (mode: SearchRelaxationMode) => void
    setQueryType: (type: QueryType) => void
    setTypoTolerance: (enabled: boolean) => void
    setMinQueryLength: (length: number) => void
    enableCombinedFilters: boolean
    toggleCombinedFilters: () => void
    toggleRequireAllCountries: () => void
    toggleRequireAllTags: () => void
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

    const insightsToShow =
        componentCount?.[CatalogComponentId.DATA_INSIGHTS] || 2

    const researchToShow = componentCount?.[CatalogComponentId.RESEARCH] || 4

    const resultsViewStyle =
        componentStyles[CatalogComponentId.RESULTS] ||
        CatalogComponentStyle.GRID

    const handleViewStyleChange = (
        _event: React.MouseEvent<HTMLElement>,
        newStyle: CatalogComponentStyle
    ) => {
        if (newStyle !== null && setComponentStyle) {
            setComponentStyle(CatalogComponentId.RESULTS, newStyle)
        }
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

                    {
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
                    }

                    {
                        <>
                            <Divider sx={{ my: 2 }} />
                            <List
                                subheader={
                                    <ListSubheader>
                                        Search Settings
                                    </ListSubheader>
                                }
                            >
                                <ListItem>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={requireAllTags}
                                                onChange={toggleRequireAllTags}
                                                color="primary"
                                            />
                                        }
                                        label="Require all selected topics"
                                    />
                                </ListItem>

                                <ListItem>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={requireAllCountries}
                                                onChange={
                                                    toggleRequireAllCountries
                                                }
                                                color="primary"
                                            />
                                        }
                                        label="Require all selected countries"
                                    />
                                </ListItem>

                                <ListItem>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={typoTolerance}
                                                onChange={() =>
                                                    setTypoTolerance(
                                                        !typoTolerance
                                                    )
                                                }
                                                color="primary"
                                            />
                                        }
                                        label="Typo tolerance"
                                    />
                                </ListItem>

                                <ListItem>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={enableCombinedFilters}
                                                onChange={toggleCombinedFilters}
                                                color="primary"
                                            />
                                        }
                                        label="Enable combined filters"
                                    />
                                </ListItem>

                                <ListItem>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="min-query-length-label">
                                            Minimum query length
                                        </InputLabel>
                                        <Select
                                            labelId="min-query-length-label"
                                            id="min-query-length-select"
                                            value={minQueryLength}
                                            label="Minimum query length"
                                            onChange={(e) =>
                                                setMinQueryLength(
                                                    Number(e.target.value)
                                                )
                                            }
                                        >
                                            <MenuItem value={1}>1</MenuItem>
                                            <MenuItem value={2}>2</MenuItem>
                                            <MenuItem value={3}>3</MenuItem>
                                            <MenuItem value={4}>4</MenuItem>
                                            <MenuItem value={5}>5</MenuItem>
                                        </Select>
                                    </FormControl>
                                </ListItem>

                                <ListItem>
                                    <Box sx={{ width: "100%" }}>
                                        <FormControl component="fieldset">
                                            <FormLabel component="legend">
                                                Prefix matching
                                            </FormLabel>
                                            <RadioGroup
                                                value={queryType}
                                                onChange={(e) =>
                                                    setQueryType(
                                                        e.target
                                                            .value as QueryType
                                                    )
                                                }
                                            >
                                                <FormControlLabel
                                                    value={QueryType.PREFIX_ALL}
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="prefixAll"
                                                />
                                                <FormHelperText>
                                                    Every word in the query is a
                                                    prefix.
                                                </FormHelperText>

                                                <FormControlLabel
                                                    value={
                                                        QueryType.PREFIX_LAST
                                                    }
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="prefixLast"
                                                />
                                                <FormHelperText>
                                                    Only the last word in the
                                                    query is treated as a
                                                    prefix. Other words in the
                                                    query must be complete
                                                    matches.
                                                </FormHelperText>

                                                <FormControlLabel
                                                    value={
                                                        QueryType.PREFIX_NONE
                                                    }
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="prefixNone"
                                                />
                                                <FormHelperText>
                                                    Prefix search is turned off.
                                                    Only matches with full words
                                                    are considered.
                                                </FormHelperText>
                                            </RadioGroup>
                                        </FormControl>
                                    </Box>
                                </ListItem>

                                <ListItem>
                                    <Box sx={{ width: "100%" }}>
                                        <FormControl component="fieldset">
                                            <FormLabel component="legend">
                                                No results behaviour
                                            </FormLabel>
                                            <RadioGroup
                                                value={searchRelaxationMode}
                                                onChange={(e) =>
                                                    setSearchRelaxationMode(
                                                        e.target
                                                            .value as SearchRelaxationMode
                                                    )
                                                }
                                            >
                                                <FormControlLabel
                                                    value={
                                                        SearchRelaxationMode.NONE
                                                    }
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="Strict matching"
                                                />
                                                <FormControlLabel
                                                    value={
                                                        SearchRelaxationMode.FIRST_WORDS
                                                    }
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="Remove first words"
                                                />
                                                <FormControlLabel
                                                    value={
                                                        SearchRelaxationMode.LAST_WORDS
                                                    }
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="Remove last words"
                                                />
                                                <FormControlLabel
                                                    value={
                                                        SearchRelaxationMode.ALL_OPTIONAL
                                                    }
                                                    control={
                                                        <Radio size="small" />
                                                    }
                                                    label="All words optional"
                                                />
                                            </RadioGroup>
                                        </FormControl>
                                    </Box>
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />
                            <List
                                subheader={
                                    <ListSubheader>
                                        Display Settings
                                    </ListSubheader>
                                }
                            >
                                <ListItem>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={isStickyHeader}
                                                onChange={toggleStickyHeader}
                                                color="primary"
                                            />
                                        }
                                        label="Sticky header"
                                    />
                                </ListItem>

                                <ListItem>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="insights-count-label">
                                            Data Insights to Show
                                        </InputLabel>
                                        <Select
                                            labelId="insights-count-label"
                                            id="insights-count-select"
                                            value={insightsToShow}
                                            label="Data Insights to Show"
                                            onChange={(e) =>
                                                setComponentCount(
                                                    CatalogComponentId.DATA_INSIGHTS,
                                                    Number(e.target.value)
                                                )
                                            }
                                        >
                                            <MenuItem value={2}>2</MenuItem>
                                            <MenuItem value={4}>4</MenuItem>
                                            <MenuItem value={6}>6</MenuItem>
                                            <MenuItem value={8}>8</MenuItem>
                                            <MenuItem value={10}>10</MenuItem>
                                        </Select>
                                    </FormControl>
                                </ListItem>

                                <ListItem>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id="research-count-label">
                                            Research Items to Show
                                        </InputLabel>
                                        <Select
                                            labelId="research-count-label"
                                            id="research-count-select"
                                            value={researchToShow}
                                            label="Research Items to Show"
                                            onChange={(e) =>
                                                setComponentCount(
                                                    CatalogComponentId.RESEARCH,
                                                    Number(e.target.value)
                                                )
                                            }
                                        >
                                            <MenuItem value={2}>2</MenuItem>
                                            <MenuItem value={4}>4</MenuItem>
                                            <MenuItem value={6}>6</MenuItem>
                                            <MenuItem value={8}>8</MenuItem>
                                            <MenuItem value={10}>10</MenuItem>
                                        </Select>
                                    </FormControl>
                                </ListItem>

                                <ListItem>
                                    <Box sx={{ width: "100%" }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ mb: 1 }}
                                        >
                                            Results View
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={resultsViewStyle}
                                            exclusive
                                            onChange={handleViewStyleChange}
                                            aria-label="results view style"
                                            size="small"
                                            fullWidth
                                        >
                                            <ToggleButton
                                                value={
                                                    CatalogComponentStyle.GRID
                                                }
                                                aria-label="grid view"
                                            >
                                                <GridViewIcon
                                                    fontSize="small"
                                                    sx={{ mr: 1 }}
                                                />
                                                Grid
                                            </ToggleButton>
                                            <ToggleButton
                                                value={
                                                    CatalogComponentStyle.TABLE
                                                }
                                                aria-label="table view"
                                            >
                                                <ViewListIcon
                                                    fontSize="small"
                                                    sx={{ mr: 1 }}
                                                />
                                                Table
                                            </ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                </ListItem>
                            </List>
                        </>
                    }
                </Box>
            </Drawer>
        </>
    )
}
