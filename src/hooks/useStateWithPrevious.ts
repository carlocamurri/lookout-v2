import { Dispatch, SetStateAction, useState } from "react"
import { usePrevious } from "./usePrevious"

export const useStateWithPrevious = <T>(value: T): [T, Dispatch<SetStateAction<T>>, T?] => {
  const [currentValue, setCurrentValue] = useState(value)
  const previousValue = usePrevious(currentValue)
  return [currentValue, setCurrentValue, previousValue]
}
