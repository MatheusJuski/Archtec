import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useThemeStore } from "@/store/theme"
import type { ShaderPalette } from "./ShaderCanvas"

const ShaderCanvas = lazy(() => import("./ShaderCanvas"))

function readPalette(el: HTMLElement, isDark: boolean): ShaderPalette {
  const css = getComputedStyle(el)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    base: read("--surface-1", "#15171a"),
    brand: read("--brand", "#6f8cff"),
    signal: read("--signal", "#f2b455"),
    deep: isDark ? "#0b1240" : "#1b2f8a",
  }
}

function canUseShader() {
  if (typeof window === "undefined") return false
  if (!("gpu" in navigator)) return false
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

interface ShaderBackdropProps {
  className?: string
  /** Velocidade da animação (0–10) */
  speed?: number
  /** Usa a paleta escura independente do tema (para texto claro por cima) */
  forceDark?: boolean
  children?: React.ReactNode
}

/**
 * Fundo animado em WebGPU com as cores do tema.
 * Sem WebGPU (ou com reduced-motion) fica só o fallback em CSS, que está sempre por baixo.
 */
export function ShaderBackdrop({ className, speed = 0.6, forceDark, children }: ShaderBackdropProps) {
  const theme = useThemeStore((state) => state.theme)
  const [enabled] = useState(canUseShader)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [palette, setPalette] = useState<ShaderPalette | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Espera o próximo frame para a classe do tema já estar aplicada
    const id = requestAnimationFrame(() => {
      if (ref.current) setPalette(readPalette(ref.current, forceDark || theme === "dark"))
    })
    return () => cancelAnimationFrame(id)
  }, [theme, forceDark])

  const showShader = enabled && !failed && palette

  return (
    <div ref={ref} className={cn("relative isolate overflow-hidden", forceDark && "dark", className)}>
      <div aria-hidden className="arch-shader-fallback" />
      {showShader && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <Suspense fallback={null}>
            <ShaderCanvas
              palette={palette}
              speed={speed}
              onReady={() => setReady(true)}
              onUnavailable={() => setFailed(true)}
            />
          </Suspense>
        </div>
      )}
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  )
}
