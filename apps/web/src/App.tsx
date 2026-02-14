import { Button } from "./components/ui/button"

function App() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-950 text-white">
      <h1 className="text-3xl font-bold tracking-tight">Architect Project</h1>
      <p className="text-slate-400">Frontend inicializado com sucesso.</p>
      
      <div className="flex gap-2">
        <Button variant="default">Botão Primário</Button>
        <Button variant="destructive">Teste de Variant</Button>
        <Button variant="outline" className="text-slate-950 dark:text-white">Outline</Button>
      </div>
    </div>
  )
}

export default App