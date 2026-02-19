import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function LoginPage() {
  // Estado para controlar o carrossel
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const plugin = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false })
  );

  // Seus slides com as imagens personalizadas
const slides = [
    {
      image: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=2070&auto=format&fit=crop",
      title: "Centralize suas ideias",
      description: "Um Segundo Cérebro digital baseado no método Zettelkasten para gestão de conhecimento."
    },
    {
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
      title: "Foco no que importa",
      description: "Gestão de projetos com árvores de tarefas infinitas e grafos de dependência."
    },
    {
      image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2000",
      title: "Controle total",
      description: "Unifique finanças, execução e conhecimento em uma única arquitetura de software."
    }
  ];

  // Efeito para monitorar a mudança de slides
  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2 bg-slate-950">
      
      {/* --- COLUNA ESQUERDA (Visual) --- */}
      <div className="hidden h-full flex-col bg-slate-900 text-white lg:flex relative border-r border-slate-800">
        
        {/* Logo Discreto no Topo (Desktop) */}
        <div className="absolute left-8 top-8 z-20 flex items-center font-medium tracking-tight text-white/90">
          <Logo className="mr-3 w-8 h-8 text-white" />
          <span className="text-xl tracking-wide">Archtec</span>
        </div>

        <Carousel
          setApi={setApi}
          plugins={[plugin.current]}
          className="h-full w-full [&>div]:h-full"
          opts={{ loop: true, align: "start" }}
        >
          <CarouselContent className="h-full ml-0"> 
            {slides.map((slide, index) => (
              <CarouselItem key={index} className="pl-0 flex h-full items-center justify-center">
                 <div className="relative w-full h-full">
                    {/* Imagem de Fundo com Zoom suave */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-2000"
                      style={{ backgroundImage: `url(${slide.image})` }}
                    />
                    
                    {/* Degradê (Correção: bg-gradient-to-t) */}
                    <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* Conteúdo Centralizado na parte inferior */}
                    <div className="absolute bottom-24 left-0 right-0 px-12 text-center z-20 flex flex-col items-center">
                      <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        {slide.title}
                      </h2>
                      <p className="text-lg text-slate-300 font-light max-w-md">
                        {slide.description}
                      </p>
                    </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* --- INDICADORES (BARRINHAS) --- */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2 z-30">
          {Array.from({ length: count }).map((_, index) => (
            <button
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 ease-out",
                current === index + 1 
                  ? "w-8 bg-white" 
                  : "w-1.5 bg-white/30 hover:bg-white/50"
              )}
              onClick={() => api?.scrollTo(index)}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>

      </div>

      {/* --- COLUNA DIREITA (Formulário) --- */}
      <div className="flex items-center justify-center p-8 h-full bg-slate-950">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-87.5 relative z-10">
          
          {/* Logo Mobile */}
          <div className="lg:hidden flex items-center justify-center mb-6 font-medium tracking-tight text-white">
             <Logo className="mr-3 w-10 h-10 text-white" />
             <span className="text-2xl">Archtec</span>
          </div>

          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Bem-vindo de volta!
            </h1>
            <p className="text-sm text-slate-400">
              Entre para continuar construindo.
            </p>
          </div>

          <div className="[&>div]:border-0 [&>div]:shadow-none [&>div]:bg-transparent [&>div]:p-0">
             <LoginForm />
          </div>

          <p className="px-8 text-center text-sm text-slate-600">
            © 2026 Architect Inc.
          </p>
        </div>
      </div>
    </div>
  );
}