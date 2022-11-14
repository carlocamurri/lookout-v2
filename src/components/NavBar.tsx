import React from "react"

import { AppBar, Tab, Tabs, Toolbar, Typography } from "@mui/material"
import Grid from "@mui/material/Grid"
import { Link, useLocation, useNavigate } from "react-router-dom"

import styles from "./NavBar.module.css"

interface Page {
  title: string
  location: string
}

const PAGES: Page[] = [
  {
    title: "Jobs",
    location: "/",
  },
  {
    title: "Stats",
    location: "/stats",
  },
  {
    title: "Admin",
    location: "/admin",
  },
]

// Creates mapping from location to index of element in ordered navbar
function getLocationMap(pages: Page[]): Map<string, number> {
  const locationMap = new Map<string, number>()
  pages.forEach((page, index) => {
    locationMap.set(page.location, index)
  })
  return locationMap
}

const locationMap = getLocationMap(PAGES)

function locationFromIndex(pages: Page[], index: number): string {
  if (pages[index]) {
    return pages[index].location
  }
  return "/"
}

function NavBar(props: { width: number; height: number }) {
  const currentLocation = useLocation().pathname
  const navigate = useNavigate()

  const currentValue = locationMap.has(currentLocation) ? locationMap.get(currentLocation) : 0
  return (
    <AppBar
      position="static"
      className={styles.container}
      style={{
        width: props.width,
        height: props.height,
      }}
    >
      <Toolbar>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <a href="/" className={styles.title}>
              <img className={styles.logo} src={process.env.PUBLIC_URL + "./Armada-white-rectangle.png"} alt={""} />
              <Typography variant="h6">Lookout</Typography>
            </a>
          </Grid>
          <Grid item xs={4}>
            <Tabs
              indicatorColor="secondary"
              textColor="secondary"
              value={currentValue}
              onChange={(event, newIndex) => {
                const newLocation = locationFromIndex(PAGES, newIndex)
                navigate(newLocation)
              }}
            >
              {PAGES.map((page, idx) => (
                <Tab key={idx} label={page.title} component={Link} to={page.location} disabled={idx > 0} />
              ))}
            </Tabs>
          </Grid>
          <Grid item xs={4} />
        </Grid>
      </Toolbar>
    </AppBar>
  )
}

export default NavBar
