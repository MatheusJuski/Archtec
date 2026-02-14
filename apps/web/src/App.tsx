import { LoginForm } from "@/components/LoginForm"
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <LoginForm />
      <Toaster position="top-right" richColors />
    </div>
  )
}

export default App