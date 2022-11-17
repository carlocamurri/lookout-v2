import React from "react"

import { render, screen } from "@testing-library/react"

import App from "./App"

test("renders jobs page", () => {
  render(<App />)
  const instances = screen.getAllByText(/jobs/i)
  expect(instances.length).toBeGreaterThan(0);
})
