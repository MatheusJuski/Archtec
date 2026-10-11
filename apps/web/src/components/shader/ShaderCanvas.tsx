import { Shader, FlowingGradient, FilmGrain } from "shaders/react"

export interface ShaderPalette {
  base: string
  brand: string
  signal: string
  deep: string
}

interface ShaderCanvasProps {
  palette: ShaderPalette
  speed: number
  onReady: () => void
  onUnavailable: () => void
}

/** Carregado sob demanda: mantém o engine WebGPU fora do bundle inicial. */
export default function ShaderCanvas({ palette, speed, onReady, onUnavailable }: ShaderCanvasProps) {
  return (
    <Shader
      className="absolute inset-0 h-full w-full"
      disableTelemetry
      onReady={onReady}
      onUnavailable={onUnavailable}
    >
      <FilmGrain strength={0.18} bias={1.5}>
        <FlowingGradient
          colorA={palette.base}
          colorB={palette.brand}
          colorC={palette.signal}
          colorD={palette.deep}
          speed={speed}
          distortion={0.55}
          seed={7}
        />
      </FilmGrain>
    </Shader>
  )
}
