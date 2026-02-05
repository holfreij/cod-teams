import { CheckboxCard as ChakraCheckboxCard } from "@chakra-ui/react"
import * as React from "react"

export interface CheckboxCardProps extends ChakraCheckboxCard.RootProps {
  icon?: React.ReactElement
  label?: React.ReactNode
  description?: React.ReactNode
  addon?: React.ReactNode
  indicator?: React.ReactNode | null
  indicatorPlacement?: "start" | "end" | "inside"
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}

// Cyberpunk color scheme
const cyberStyles = {
  root: {
    borderColor: "rgba(0, 255, 255, 0.3)",
    background: "linear-gradient(145deg, rgba(20, 20, 40, 0.9), rgba(10, 10, 20, 0.95))",
    _hover: {
      borderColor: "rgba(0, 255, 255, 0.6)",
    },
    _checked: {
      borderColor: "#00ffff",
      background: "linear-gradient(145deg, rgba(0, 255, 255, 0.15), rgba(10, 10, 20, 0.95))",
    }
  },
  control: {
    borderColor: "rgba(0, 255, 255, 0.3)",
    background: "linear-gradient(145deg, rgba(20, 20, 40, 0.9), rgba(10, 10, 20, 0.95))",
    _hover: {
      borderColor: "rgba(0, 255, 255, 0.6)",
    },
    _checked: {
      borderColor: "#00ffff",
      background: "linear-gradient(145deg, rgba(0, 255, 255, 0.15), rgba(10, 10, 20, 0.95))",
    }
  },
  label: {
    color: "#00ffff",
  },
  indicator: {
    borderColor: "rgba(0, 255, 255, 0.5)",
    _checked: {
      background: "#00ffff",
      borderColor: "#00ffff",
      color: "#0a0a0a",
    }
  }
}

export const CheckboxCard = React.forwardRef<
  HTMLInputElement,
  CheckboxCardProps
>(function CheckboxCard(props, ref) {
  const {
    inputProps,
    label,
    description,
    icon,
    addon,
    indicator = <ChakraCheckboxCard.Indicator css={cyberStyles.indicator} />,
    indicatorPlacement = "end",
    ...rest
  } = props

  const hasContent = label || description || icon
  const ContentWrapper = indicator ? ChakraCheckboxCard.Content : React.Fragment

  return (
    <ChakraCheckboxCard.Root css={cyberStyles.root} {...rest}>
      <ChakraCheckboxCard.HiddenInput ref={ref} {...inputProps} />
      <ChakraCheckboxCard.Control css={cyberStyles.control}>
        {indicatorPlacement === "start" && indicator}
        {hasContent && (
          <ContentWrapper>
            {icon}
            {label && (
              <ChakraCheckboxCard.Label css={cyberStyles.label}>{label}</ChakraCheckboxCard.Label>
            )}
            {description && (
              <ChakraCheckboxCard.Description>
                {description}
              </ChakraCheckboxCard.Description>
            )}
            {indicatorPlacement === "inside" && indicator}
          </ContentWrapper>
        )}
        {indicatorPlacement === "end" && indicator}
      </ChakraCheckboxCard.Control>
      {addon && <ChakraCheckboxCard.Addon>{addon}</ChakraCheckboxCard.Addon>}
    </ChakraCheckboxCard.Root>
  )
})

export const CheckboxCardIndicator = ChakraCheckboxCard.Indicator
