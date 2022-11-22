import React, { useState } from "react"

import { Check, Delete, Edit } from "@mui/icons-material"
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined"
import {
  Button,
  Checkbox,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from "@mui/material"

import styles from "./ColumnSelect.module.css"
import { ColumnSpec } from "utils/jobsTableColumns"

const ITEM_HEIGHT = 54
const MENU_PADDING = 8

type ColumnSelectProps = {
  height: number
  columns: ColumnSpec[]
  onAddAnnotation: (annotationKey: string) => void
  onToggleColumn: (columnKey: string) => void
  onRemoveAnnotation: (columnKey: string) => void
  onEditAnnotation: (columnKey: string, annotationKey: string) => void
}

export default function ColumnSelect({
  height,
  columns,
  onAddAnnotation,
  onToggleColumn,
  onRemoveAnnotation,
  onEditAnnotation,
}: ColumnSelectProps) {
  const [creatingAnnotation, setCreatingAnnotation] = useState(false)
  const [newAnnotationKey, setNewAnnotationKey] = useState("")

  const [currentlyEditing, setCurrentlyEditing] = useState(new Map<string, string>())

  function clearAddAnnotation() {
    setCreatingAnnotation(false)
    setNewAnnotationKey("")
  }

  function saveNewAnnotation() {
    onAddAnnotation(newAnnotationKey)
    clearAddAnnotation()
  }

  function edit(key: string, name: string) {
    const newCurrentlyEditing = new Map<string, string>(currentlyEditing)
    newCurrentlyEditing.set(key, name)
    setCurrentlyEditing(newCurrentlyEditing)
  }

  function stopEditing(key: string) {
    if (currentlyEditing.has(key)) {
      const newCurrentlyEditing = new Map<string, string>(currentlyEditing)
      newCurrentlyEditing.delete(key)
      setCurrentlyEditing(newCurrentlyEditing)
    }
  }

  const menuHeight = ITEM_HEIGHT * Math.min(12, columns.length)

  return (
    <>
      <ViewColumnOutlinedIcon />
      <FormControl sx={{ m: 0, width: 200 }}>
        <InputLabel id="checkbox-select-label">Columns</InputLabel>
        <Select
          labelId="checkbox-select-label"
          id="demo-multiple-checkbox"
          multiple
          value={columns.map((col) => col.selected)}
          input={<OutlinedInput label="Column" />}
          renderValue={(selected) => {
            return `${selected.length} columns selected`
          }}
          MenuProps={{
            PaperProps: {
              style: {
                height: menuHeight + 2 * MENU_PADDING,
                maxWidth: 750,
              },
            },
          }}
          sx={{ maxHeight: height }}
        >
          <div
            className={styles.columnMenu}
            style={{
              height: menuHeight,
            }}
          >
            <div className={styles.columnSelect} style={{ height: "100%" }}>
              {columns.map((column) => (
                <MenuItem key={column.key} value={column.name}>
                  <Checkbox checked={column.selected} onClick={() => onToggleColumn(column.key)} />
                  {column.isAnnotation ? (
                    <>
                      {currentlyEditing.has(column.key) ? (
                        <>
                          <TextField
                            label="Annotation Key"
                            size="small"
                            variant="standard"
                            value={currentlyEditing.get(column.key)}
                            onChange={(e) => edit(column.key, e.target.value)}
                            style={{
                              maxWidth: 350,
                            }}
                            fullWidth={true}
                          />
                          <IconButton
                            onClick={() => {
                              if (currentlyEditing.has(column.key)) {
                                onEditAnnotation(column.key, currentlyEditing.get(column.key) ?? "")
                              }
                              stopEditing(column.key)
                            }}
                          >
                            <Check />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <ListItemText
                            primary={column.name}
                            style={{
                              maxWidth: 350,
                              overflowX: "auto",
                            }}
                          />
                          <IconButton onClick={() => edit(column.key, column.name)}>
                            <Edit />
                          </IconButton>
                        </>
                      )}
                      <IconButton
                        onClick={() => {
                          stopEditing(column.key)
                          onRemoveAnnotation(column.key)
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </>
                  ) : (
                    <ListItemText
                      primary={column.name}
                      style={{
                        maxWidth: 350,
                        overflowX: "auto",
                      }}
                    />
                  )}
                </MenuItem>
              ))}
            </div>
            <Divider orientation="vertical" style={{ height: "100%" }} />
            <div className={styles.annotationSelectContainer}>
              <Typography display="block" variant="caption" sx={{ width: "100%" }}>
                Click here to add an annotation column.
              </Typography>
              <Typography display="block" variant="caption" sx={{ width: "100%" }}>
                Annotations are metadata (key-value pairs) that you can add to your job.
              </Typography>
              <div className={styles.addColumnButton}>
                {creatingAnnotation ? (
                  <>
                    <TextField
                      variant="outlined"
                      label="Annotation Key"
                      size="small"
                      sx={{ width: "100%" }}
                      value={newAnnotationKey}
                      onChange={(e) => {
                        setNewAnnotationKey(e.target.value)
                      }}
                      onKeyUp={(e) => {
                        if (e.key === "Enter") {
                          saveNewAnnotation()
                        }
                      }}
                    />
                    <div className={styles.addAnnotationButtons}>
                      <div className={styles.addAnnotationAction}>
                        <Button variant="outlined" onClick={clearAddAnnotation}>
                          Cancel
                        </Button>
                      </div>
                      <div className={styles.addAnnotationAction}>
                        <Button variant="contained" onClick={saveNewAnnotation}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <Button variant="contained" onClick={() => setCreatingAnnotation(true)}>
                    Add column
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Select>
      </FormControl>
    </>
  )
}
