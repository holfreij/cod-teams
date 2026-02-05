"use client"

import { ChakraProvider } from "@chakra-ui/react"
import { cyberpunkSystem } from "../../theme"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={cyberpunkSystem}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  )
}
