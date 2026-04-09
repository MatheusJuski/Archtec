import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState } from "react"
import { GoogleLogin } from "@react-oauth/google"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"


const authSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres")
})

type AuthValues = z.infer<typeof authSchema>

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  
  // 2. Estado para controlar qual tela estamos exibindo
  const [isRegistering, setIsRegistering] = useState(false) 
  
  const signIn = useAuthStore((state) => state.signIn)

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  async function onSubmit(data: AuthValues) {
    // 3. Validação manual do nome APENAS se estiver na aba de Registro
    if (isRegistering && (!data.name || data.name.trim() === "")) {
      form.setError("name", { type: "manual", message: "Nome é obrigatório para cadastro" })
      return
    }

    setIsLoading(true)
    try {
      if (isRegistering) {
        // Fluxo de Cadastro:
        // A. Cria o usuário no banco
        await api.post("/users/register", { 
          name: data.name, 
          email: data.email, 
          password: data.password 
        })
        
        // B. Já faz o login imediatamente após criar para pegar o token
        const loginResponse = await api.post("/users/login", { 
          email: data.email, 
          password: data.password 
        })
        
        signIn(loginResponse.data.access_token)
        toast.success("Conta criada com sucesso!")
        
      } else {
        // Fluxo de Login Padrão:
        const response = await api.post("/users/login", {
          email: data.email,
          password: data.password
        })
        
        signIn(response.data.access_token)
        toast.success("Login realizado com sucesso!")
      }
    } catch (error: any) {
      console.error(error)
      if (isRegistering) {
        if (error.response?.status === 409 || error.response?.data?.message?.includes("exist")) {
          toast.error("Este e-mail já está em uso.")
        } else {
          toast.error("Erro ao criar conta.")
        }
      } else {
        toast.error("Credenciais inválidas.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Limpa os erros do formulário ao alternar entre as abas
  function toggleMode() {
    setIsRegistering(!isRegistering)
    form.clearErrors()
  }

  async function handleGoogleLogin(idToken: string) {
    setIsGoogleLoading(true)
    try {
      const response = await api.post("/users/google", { idToken })
      signIn(response.data.access_token)
      toast.success("Login com Google realizado com sucesso!")
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível entrar com Google.")
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
        
        {/* Cabeçalho dinâmico opcional para melhorar a UI */}
        <div className="flex flex-col space-y-2 text-center mb-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isRegistering ? "Criar nova conta" : "Bem-vindo de volta!"}
          </h1>
          <p className="text-sm text-slate-400">
            {isRegistering ? "Preencha seus dados abaixo para começar" : "Digite seu email e senha para continuar"}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Renderização Condicional: Só exibe o Input de Nome no Registro */}
            {isRegistering && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome completo" {...field} />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="exemplo@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? "Carregando..." : (isRegistering ? "Criar Conta" : "Entrar")}
            </Button>
          </form>
        </Form>

        {googleEnabled && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>
        )}

        {googleEnabled && (
          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                if (!credentialResponse.credential) {
                  toast.error("Google não retornou um token válido.")
                  return
                }
                void handleGoogleLogin(credentialResponse.credential)
              }}
              onError={() => {
                toast.error("Falha na autenticação com Google.")
              }}
              useOneTap={false}
              text={isRegistering ? "signup_with" : "signin_with"}
              shape="pill"
              width="320"
            />
          </div>
        )}

        {googleEnabled && isGoogleLoading && (
          <p className="text-center text-xs text-muted-foreground">Validando login do Google...</p>
        )}

        {/* Botão para alternar entre Login e Cadastro */}
        <div className="text-center text-sm text-slate-400">
          {isRegistering ? "Já tem uma conta? " : "Não tem uma conta? "}
          <button
            type="button"
            onClick={toggleMode}
            className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
          >
            {isRegistering ? "Faça login" : "Cadastre-se"}
          </button>
        </div>
    </div>
  )
}