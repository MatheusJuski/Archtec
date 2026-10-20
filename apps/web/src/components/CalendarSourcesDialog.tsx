import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CalendarSourceFromApi {
  id: string;
  name: string;
  type: "ICS_URL" | "ICS_FILE";
  urlHost: string | null;
  color: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  eventCount: number;
}

interface ImportResult {
  source: CalendarSourceFromApi;
  imported: number;
  truncated: boolean;
}

interface CalendarSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando eventos foram adicionados/removidos, para recarregar o calendário. */
  onEventsChanged: () => void;
}

function formatSyncDate(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function importMessage(result: ImportResult) {
  const base = `${result.imported} evento(s) importado(s) de "${result.source.name}"`;
  return result.truncated ? `${base} (limite atingido: alguns eventos ficaram de fora)` : base;
}

export function CalendarSourcesDialog({ open, onOpenChange, onEventsChanged }: CalendarSourcesDialogProps) {
  const [sources, setSources] = useState<CalendarSourceFromApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<CalendarSourceFromApi | null>(null);

  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);

  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CalendarSourceFromApi[]>("/calendar-sources");
      setSources(res.data);
    } catch {
      toast.error("Erro ao carregar calendários externos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchSources();
  }, [open, fetchSources]);

  async function handleAddLink(event: React.FormEvent) {
    event.preventDefault();
    if (!linkUrl.trim()) {
      toast.error("Cole o link do calendário");
      return;
    }

    setIsAddingLink(true);
    try {
      const res = await api.post<ImportResult>("/calendar-sources", {
        url: linkUrl.trim(),
        name: linkName.trim() || undefined,
      });
      toast.success(importMessage(res.data));
      setLinkName("");
      setLinkUrl("");
      await fetchSources();
      onEventsChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar calendário"));
    } finally {
      setIsAddingLink(false);
    }
  }

  async function handleImportFile(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error("Selecione um arquivo .ics");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    if (fileName.trim()) body.append("name", fileName.trim());

    setIsImportingFile(true);
    try {
      const res = await api.post<ImportResult>("/calendar-sources/import", body);
      toast.success(importMessage(res.data));
      setFile(null);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchSources();
      onEventsChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao importar arquivo"));
    } finally {
      setIsImportingFile(false);
    }
  }

  async function handleSync(source: CalendarSourceFromApi) {
    setBusyId(source.id);
    try {
      const res = await api.post<ImportResult>(`/calendar-sources/${source.id}/sync`);
      toast.success(`"${source.name}" sincronizado: ${res.data.imported} evento(s)`);
      onEventsChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao sincronizar"));
    } finally {
      setBusyId(null);
      await fetchSources();
    }
  }

  async function handleColorChange(source: CalendarSourceFromApi, color: string) {
    setSources((current) => current.map((s) => (s.id === source.id ? { ...s, color } : s)));
    try {
      await api.patch(`/calendar-sources/${source.id}`, { color });
      onEventsChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao alterar a cor"));
      await fetchSources();
    }
  }

  async function performRemove(source: CalendarSourceFromApi) {
    setBusyId(source.id);
    try {
      await api.delete(`/calendar-sources/${source.id}`);
      toast.success(`"${source.name}" removido`);
      await fetchSources();
      onEventsChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover calendário"));
    } finally {
      setBusyId(null);
      setPendingRemove(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calendários externos</DialogTitle>
            <DialogDescription>
              Traga eventos do Google Agenda ou do Outlook por link (atualiza sozinho) ou por arquivo .ics (cópia única).
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-2">
            <h3 className="label-tech text-muted-foreground">Conectados</h3>
            {loading && sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : sources.length === 0 ? (
              <p className="hatch border border-dashed border-line px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum calendário externo ainda.
              </p>
            ) : (
              <ul className="divide-y divide-line border border-line">
                {sources.map((source) => (
                  <li key={source.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <input
                      type="color"
                      aria-label={`Cor de ${source.name}`}
                      value={source.color ?? "#7c5cff"}
                      onChange={(event) => void handleColorChange(source, event.target.value)}
                      className="h-6 w-6 shrink-0 cursor-pointer border border-line bg-transparent p-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{source.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {source.type === "ICS_URL" ? `Link · ${source.urlHost ?? ""}` : "Arquivo .ics"}
                        {" · "}
                        {source.eventCount} evento(s)
                        {source.type === "ICS_URL" ? ` · sincronizado ${formatSyncDate(source.lastSyncedAt)}` : ""}
                      </p>
                      {source.lastError ? (
                        <p className="text-xs text-destructive">{source.lastError}</p>
                      ) : null}
                    </div>
                    {source.type === "ICS_URL" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSync(source)}
                        disabled={busyId === source.id}
                        title="Sincronizar agora"
                      >
                        <RefreshCw className={`size-3.5 ${busyId === source.id ? "animate-spin" : ""}`} />
                        Sincronizar
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingRemove(source)}
                      disabled={busyId === source.id}
                      aria-label={`Remover ${source.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={handleAddLink} className="space-y-2 border-t border-line pt-4">
            <h3 className="flex items-center gap-2 label-tech text-muted-foreground">
              <Link2 className="size-3.5" /> Assinar por link (sincroniza)
            </h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <Input
                placeholder="Nome (opcional)"
                value={linkName}
                onChange={(event) => setLinkName(event.target.value)}
                maxLength={100}
              />
              <Input
                placeholder="https://… ou webcal://…  (.ics)"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                inputMode="url"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isAddingLink}>
                {isAddingLink ? "Importando…" : "Adicionar link"}
              </Button>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Onde encontro esse link?</summary>
              <div className="mt-2 space-y-2 leading-relaxed">
                <p>
                  <strong className="text-foreground">Google Agenda:</strong> no computador, abra Configurações → clique
                  no calendário em “Configurações das minhas agendas” → “Integrar agenda” → copie o{" "}
                  <em>Endereço secreto no formato iCal</em>.
                </p>
                <p>
                  <strong className="text-foreground">Outlook / Microsoft 365:</strong> em Outlook na Web, Configurações →
                  Calendário → Calendários compartilhados → “Publicar um calendário” → escolha o calendário e “Pode ver
                  todos os detalhes” → Publicar → copie o link <em>ICS</em>.
                </p>
                <p>O link funciona como uma senha: quem tiver acesso a ele vê sua agenda. Os eventos são somente leitura aqui e atualizam a cada abertura do calendário (no máximo a cada 15 min).</p>
              </div>
            </details>
          </form>

          <form onSubmit={handleImportFile} className="space-y-2 border-t border-line pt-4">
            <h3 className="flex items-center gap-2 label-tech text-muted-foreground">
              <Upload className="size-3.5" /> Importar arquivo .ics (cópia única)
            </h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <Input
                placeholder="Nome (opcional)"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                maxLength={100}
              />
              <Input
                ref={fileInputRef}
                type="file"
                accept=".ics,text/calendar"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Google: Configurações → Importar e exportar → Exportar (descompacte o .zip). Outlook (desktop): Arquivo →
                Salvar calendário.
              </p>
              <Button type="submit" size="sm" disabled={isImportingFile || !file}>
                {isImportingFile ? "Importando…" : "Importar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(isOpen) => !isOpen && setPendingRemove(null)}
        title="Remover calendário?"
        description={
          pendingRemove
            ? `"${pendingRemove.name}" e seus ${pendingRemove.eventCount} evento(s) serão removidos do Archtec. Nada muda no Google/Outlook.`
            : undefined
        }
        confirmLabel="Remover"
        loading={busyId !== null}
        onConfirm={() => pendingRemove && void performRemove(pendingRemove)}
      />
    </>
  );
}
