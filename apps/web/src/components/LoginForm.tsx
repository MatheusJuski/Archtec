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
import { Divider } from "@/components/ui/divider"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Loader2 } from "lucide-react"


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
        
        <div className="flex flex-col gap-2">
          <p className="label-tech flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 bg-brand" />
            {isRegistering ? "Nova conta" : "Acesso"}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {isRegistering ? "Criar nova conta" : "Bem-vindo de volta"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRegistering ? "Preencha seus dados abaixo para começar." : "Digite seu email e senha para continuar."}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Renderização Condicional: Só exibe o Input de Nome no Registro */}
            <AnimatePresence initial={false}>
            {isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </motion.div>
            )}
            </AnimatePresence>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="exemplo@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
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
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" variant="brand" size="lg" className="group mt-2 w-full justify-between" disabled={isLoading}>
              {isLoading ? "Carregando..." : (isRegistering ? "Criar conta" : "Entrar")}
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              )}
            </Button>
          </form>
        </Form>

        {googleEnabled && (
          <Divider label="ou" />
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
              shape="rectangular"
              width="320"
            />
          </div>
        )}

        {googleEnabled && isGoogleLoading && (
          <p className="text-center text-xs text-muted-foreground">Validando login do Google...</p>
        )}

        {/* Botão para alternar entre Login e Cadastro */}
        <div className="border-t border-line pt-5 text-center text-sm text-muted-foreground">
          {isRegistering ? "Já tem uma conta? " : "Não tem uma conta? "}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            {isRegistering ? "Faça login" : "Cadastre-se"}
          </button>
        </div>
    </div>
  )
}