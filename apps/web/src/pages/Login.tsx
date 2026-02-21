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
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const plugin = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false })
  );

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
    // Removido o bg-slate-950 daqui, pois as colunas terão seus próprios fundos
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      
      {/* --- COLUNA ESQUERDA (Visual com Imagem) --- */}
      <div className="hidden h-full flex-col lg:flex relative border-r border-border bg-background">
        
        {/* Logo Discreto no Topo */}
        <div className="absolute left-8 top-8 z-20 flex items-center tracking-tight text-foreground">
          <Logo className="mr-3 w-8 h-8 text-foreground" />
          <span className="text-xl font-heading tracking-wide">Archtec</span>
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
                    {/* Imagem de Fundo */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-2000"
                      style={{ backgroundImage: `url(${slide.image})` }}
                    />
                    
                    {/* Overlay Gradient: Garante a legibilidade do texto (transição para o bg do tema) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

                    {/* Conteúdo Centralizado na parte inferior */}
                    <div className="absolute bottom-24 left-0 right-0 px-12 text-center z-20 flex flex-col items-center">
                      <h2 className="font-heading text-4xl text-foreground mb-3">
                        {slide.title}
                      </h2>
                      <p className="text-lg text-muted-foreground font-sans font-light max-w-md">
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
                  ? "w-8 bg-primary" 
                  : "w-1.5 bg-primary/30 hover:bg-primary/50"
              )}
              onClick={() => api?.scrollTo(index)}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>

      </div>

      {/* --- COLUNA DIREITA --- */}
      <div className="relative flex items-center justify-center p-8 h-full overflow-hidden bg-background">
        
        {/* Efeito Aurora 1: Luz azulada suave no canto superior direito */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
        
        {/* Efeito Aurora 2: Luz mais escura no canto inferior esquerdo */}
        <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
        
        {/* Gradiente sutil central para quebrar o chapado */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#12122b]/30 to-transparent pointer-events-none" />

        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px] relative z-10">
          
          {/* Logo Mobile */}
          <div className="lg:hidden flex items-center justify-center mb-6 text-foreground">
             <Logo className="mr-3 w-10 h-10 text-foreground" />
             <span className="text-2xl font-heading tracking-wide">Archtec</span>
          </div>

          <div className="flex flex-col space-y-2 text-center">
            <h1 className="font-heading text-4xl tracking-tight text-foreground">
              BEM-VINDO DE VOLTA!
            </h1>
            <p className="text-sm font-sans text-muted-foreground">
              Entre para continuar construindo.
            </p>
          </div>

          {/* Wrapper do Formulário */}
          <div className="[&>div]:border-0 [&>div]:shadow-none [&>div]:bg-transparent [&>div]:p-0">
             <LoginForm />
          </div>

          <p className="px-8 text-center text-sm font-sans text-muted-foreground/50">
            © 2026 Architect Inc.
          </p>
        </div>
      </div>
    </div>
  );
}