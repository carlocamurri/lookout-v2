import React, { useMemo } from "react"

import { createTheme, ThemeProvider } from "@mui/material"
import { grey, red } from "@mui/material/colors"
import { BrowserRouter, Route, Routes } from "react-router-dom"

import { makeTestJobs } from "utils"

import NavBar from "components/NavBar"
import FakeGetJobsService from "services/mocks/FakeGetJobsService"
import FakeGroupJobsService from "services/mocks/FakeGroupJobsService"

import JobsPage from "./JobsPage"
import "./App.css"

const theme = createTheme({
  palette: {
    primary: {
      main: "#00aae1",
      contrastText: "#fff",
    },
    secondary: {
      main: grey.A100,
    },
    error: {
      main: red.A400,
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      "'Segoe UI'",
      "'Roboto'",
      "'Oxygen'",
      "'Ubuntu'",
      "'Cantarell'",
      "'Fira Sans'",
      "'Droid Sans'",
      "'Helvetica Neue'",
      "sans-serif",
    ].join(","),
  },
})

function App() {
  const testJobs = useMemo(() => makeTestJobs(10000, 42), [])
  const jobsService = useMemo(() => new FakeGetJobsService(testJobs), [testJobs])
  const groupJobsService = useMemo(() => new FakeGroupJobsService(testJobs), [testJobs])

  return (
    <ThemeProvider theme={theme}>
      <div className="App">
        <BrowserRouter>
          <NavBar />
          <Routes>
            <Route
              path="/"
              element={
                <JobsPage
                  getJobsService={jobsService}
                  groupJobsService={groupJobsService}
                />
              }
            />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  )
}

export default App
