import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        cyber: {
          cyan: { value: "#00ffff" },
          pink: { value: "#ff0080" },
          dark: { value: "#0a0a0a" },
          darkSecondary: { value: "#1a0a2e" },
        }
      }
    }
  }
})

export const cyberpunkSystem = createSystem(defaultConfig, customConfig)
