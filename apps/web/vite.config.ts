import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// Bibliotecas estáveis em chunks próprios: mudam raramente, então ficam em cache entre deploys
const vendorChunks: Record<string, string[]> = {
  "vendor-react": ["react", "react-dom", "react-router", "react-router-dom", "scheduler"],
  "vendor-motion": ["motion", "framer-motion", "motion-dom", "motion-utils"],
}

export default defineConfig({
  plugins: [react(),
  tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          for (const [chunk, packages] of Object.entries(vendorChunks)) {
            if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`))) {
              return chunk
            }
          }
        },
      },
    },
  },
})
