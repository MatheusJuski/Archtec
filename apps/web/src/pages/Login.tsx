import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { ShaderBackdrop } from "@/components/shader/ShaderBackdrop";

const slides = [
  {
    tag: "Conhecimento",
    title: "Centralize suas ideias",
    description: "Um Segundo Cérebro digital baseado no método Zettelkasten para gestão de conhecimento.",
  },
  {
    tag: "Execução",
    title: "Foco no que importa",
    description: "Gestão de projetos com árvores de tarefas infinitas e grafos de dependência.",
  },
  {
    tag: "Finanças",
    title: "Controle total",
    description: "Unifique finanças, execução e conhecimento em uma única arquitetura de software.",
  },
];

const SLIDE_MS = 5000;
const ease = [0.22, 1, 0.36, 1] as const;

export function LoginPage() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setCurrent((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [current]);

  const slide = slides[current];

  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* --- Painel visual --- */}
      <ShaderBackdrop forceDark className="hidden border-r border-ink lg:block">
        <div className="flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="h-9 text-white" />
              <span className="font-heading text-lg font-bold tracking-tight">Archtec</span>
            </div>
            <span className="label-tech border border-white/40 px-2 py-1.5 text-white/80">Life OS</span>
          </div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="font-heading text-[clamp(4.5rem,9vw,9rem)] font-bold leading-[0.82] tracking-[-0.06em] mix-blend-overlay"
              aria-hidden
            >
              ARCH
              <br />
              TEC.
            </motion.h1>

            <div className="mt-10 max-w-md">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease }}
                >
                  <span className="chip bg-white text-black">{slide.tag}</span>
                  <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight">{slide.title}</h2>
                  <p className="mt-2 text-white/80">{slide.description}</p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex gap-2">
                {slides.map((s, index) => (
                  <button
                    key={s.tag}
                    onClick={() => setCurrent(index)}
                    aria-label={`Ir para slide ${index + 1}`}
                    className="relative h-1 w-14 overflow-hidden bg-white/25"
                  >
                    {index === current && (
                      <motion.span
                        key={current}
                        className="absolute inset-y-0 left-0 bg-white"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
                      />
                    )}
                    {index < current && <span className="absolute inset-0 bg-white/70" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ShaderBackdrop>

      {/* --- Formulário --- */}
      <div className="dot-field relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
          <div className="flex items-center gap-3 text-foreground lg:hidden">
            <Logo className="h-10" />
            <span className="font-heading text-2xl font-bold tracking-tight">Archtec</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="border border-ink bg-card p-6 shadow-[6px_6px_0_0_var(--ink)] sm:p-8"
          >
            <LoginForm />
          </motion.div>

          <p className="label-tech text-center text-muted-foreground">
            © {new Date().getFullYear()} Archtec
          </p>
        </div>
      </div>
    </div>
  );
}
