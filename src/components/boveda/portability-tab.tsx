"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  FileJson,
  FileText,
  FileArchive,
  Upload,
  ArrowLeftRight,
  ShieldCheck,
  ShieldOff,
  Server,
  Info,
  Archive,
  RotateCcw,
  Trash2,
  History,
  PackageOpen,
  Share2,
  Lock,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useBoveda, type EncryptedBackupFile } from "@/lib/store";
import { sealMemory, type SealedEnvelope } from "@/lib/seal";
import { buildShareFile, shareFilename } from "@/lib/share";
import { passphraseStrength } from "@/lib/crypto";
import {
  buildExport,
  buildMarkdown,
  buildContinuationPack,
  buildZip,
  download,
  downloadBlob,
} from "@/lib/exporters";
import { parseBovedaExport } from "@/lib/importers";
import type { BovedaExport } from "@/lib/types";

const STRENGTHS = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Excelente"];

export default function PortabilityTab() {
  const memories = useBoveda((s) => s.memories);
  const backups = useBoveda((s) => s.backups);
  const refreshBackups = useBoveda((s) => s.refreshBackups);
  const createBackup = useBoveda((s) => s.createBackup);
  const restoreBackup = useBoveda((s) => s.restoreBackup);
  const deleteBackup = useBoveda((s) => s.deleteBackup);
  const importBackupFile = useBoveda((s) => s.importBackupFile);

  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<EncryptedBackupFile | null>(null);
  const [sealBusy, setSealBusy] = useState(false);
  /* compartir */
  const [shareId, setShareId] = useState<string>("");
  const [sharePass, setSharePass] = useState("");
  const [shareConfirm, setShareConfirm] = useState("");
  const [shareHint, setShareHint] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  /* importar compartido */
  const [pendingShare, setPendingShare] = useState<{ data: unknown; name: string } | null>(null);
  const [shareOpenPass, setShareOpenPass] = useState("");
  const [shareOpenBusy, setShareOpenBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const shareFileRef = useRef<HTMLInputElement>(null);

  const stamp = new Date().toISOString().slice(0, 10);
  const verifiedCount = memories.filter((m) => m.verified).length;
  const sealedCount = memories.filter((m) => m.sealed).length;
  const unsealed = memories.filter((m) => !m.sealed).length;
  const shareTarget = memories.find((m) => m.id === shareId) ?? null;

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups]);

  function requireMemories(): boolean {
    if (memories.length === 0) {
      toast.error("La bóveda está vacía: no hay nada que exportar todavía.");
      return false;
    }
    return true;
  }

  function exportJson() {
    if (!requireMemories()) return;
    const doc = buildExport(memories);
    download(`boveda-${stamp}.json`, JSON.stringify(doc, null, 2), "application/json");
    toast.success(`Exportado boveda-${stamp}.json (${doc.count} recuerdos)`);
  }

  function exportMarkdown() {
    if (!requireMemories()) return;
    download(`boveda-${stamp}.md`, buildMarkdown(memories), "text/markdown");
    toast.success(`Exportado boveda-${stamp}.md`);
  }

  function exportZip() {
    if (!requireMemories()) return;
    downloadBlob(`boveda-${stamp}.zip`, buildZip(memories));
    toast.success(`Paquete portátil boveda-${stamp}.zip (${memories.length} recuerdos, comprimido)`);
  }

  function exportContinuation() {
    if (!requireMemories()) return;
    download(`continuacion-${stamp}.md`, buildContinuationPack(memories), "text/markdown");
    toast.success("Paquete de continuación listo: pégalo en una IA nueva para retomar el contexto", {
      duration: 7000,
    });
  }

  async function onFile(f: File) {
    setBusy(true);
    try {
      if (!f.name.toLowerCase().endsWith(".json")) {
        toast.error("El formato BÓVEDA se importa desde un .json (boveda-*.json).");
        return;
      }
      const data = JSON.parse(await f.text()) as BovedaExport;
      if (data.format !== "boveda.open-memory") {
        toast.error("Este archivo no es del formato boveda.open-memory. Usa la pestaña Importar.");
        return;
      }
      const items = parseBovedaExport(data);
      toast.info(
        `Formato BÓVEDA v${data.version}: ${items.length} recuerdos detectados. Continúa en la pestaña Importar para revisarlos.`,
        { duration: 6000 },
      );
      window.dispatchEvent(new CustomEvent("boveda:import-review", { detail: items }));
    } catch {
      toast.error("JSON inválido o corrupto.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* ── respaldos ── */

  async function onBackupFile(f: File) {
    setBusy(true);
    try {
      const data = JSON.parse(await f.text()) as EncryptedBackupFile;
      if (data?.format !== "boveda.encrypted-backup") {
        toast.error("No es un respaldo cifrado BÓVEDA (boveda-respaldo-*.json).");
        return;
      }
      if (memories.length > 0) {
        toast.error(
          "Para adoptar un respaldo externo la bóveda local debe estar vacía (es una restauración completa). Exporta o vacía la actual primero.",
          { duration: 8000 },
        );
        return;
      }
      setPendingFile(data);
    } catch {
      toast.error("El archivo de respaldo no es válido.");
    } finally {
      setBusy(false);
      if (backupFileRef.current) backupFileRef.current.value = "";
    }
  }

  async function doImportBackupFile() {
    if (!pendingFile) return;
    setBackupBusy(true);
    try {
      const r = await importBackupFile(pendingFile);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo adoptar el respaldo.");
        return;
      }
      toast.success(
        `Respaldo adoptado: ${r.count} recuerdos cifrados esperando. Desbloquea con la frase ORIGINAL del respaldo.`,
        { duration: 9000 },
      );
      setPendingFile(null);
    } finally {
      setBackupBusy(false);
    }
  }

  function downloadEncryptedSnapshot() {
    if (!requireMemories()) return;
    setBackupBusy(true);
    void (async () => {
      try {
        const vres = await fetch("/api/vault", { cache: "no-store" });
        const v = (await vres.json()) as {
          exists: boolean;
          salt?: string;
          verifier?: string;
          verifierIv?: string;
        };
        if (!v.exists || !v.salt || !v.verifier || !v.verifierIv) {
          toast.error("No hay bóveda activa en este dispositivo.");
          return;
        }
        const { key } = { key: useBoveda.getState().key };
        if (!key) {
          toast.error("La bóveda está bloqueada.");
          return;
        }
        const envelopes: SealedEnvelope[] = [];
        for (const m of memories) {
          const sealed = await sealMemory(key, {
            plain: m.plain,
            kind: m.kind,
            source: m.source,
            sourceRef: m.sourceRef,
            obtainedAt: m.obtainedAt,
            imported: m.imported,
            verified: m.verified,
          });
          envelopes.push(sealed);
        }
        const file: EncryptedBackupFile = {
          format: "boveda.encrypted-backup",
          version: 1,
          createdAt: new Date().toISOString(),
          count: memories.length,
          vault: { salt: v.salt, verifier: v.verifier, verifierIv: v.verifierIv },
          payload: JSON.stringify(envelopes),
        };
        download(
          `boveda-respaldo-${stamp}.json`,
          JSON.stringify(file, null, 2),
          "application/json",
        );
        toast.success("Respaldo cifrado descargado: guarda el archivo con tu frase a buen recaudo", {
          duration: 7000,
        });
      } catch {
        toast.error("No se pudo generar el respaldo descargable.");
      } finally {
        setBackupBusy(false);
      }
    })();
  }

  async function onCreateBackup() {
    if (!requireMemories()) return;
    setBackupBusy(true);
    try {
      await createBackup(`Manual: ${memories.length} recuerdos`);
      toast.success("Respaldo cifrado creado en el servidor");
    } catch {
      toast.error("No se pudo crear el respaldo.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function onSealAll() {
    if (unsealed === 0) return;
    setSealBusy(true);
    try {
      const n = await useBoveda.getState().sealAllMetadata();
      toast.success(
        n > 0
          ? `Blindados ${n} recuerdos: el servidor ya no ve tipo, origen ni fechas.`
          : "No quedaba nada por blindar.",
        { duration: 6000 },
      );
    } catch {
      toast.error("No se pudieron blindar los metadatos.");
    } finally {
      setSealBusy(false);
    }
  }

  /* ── compartir una memoria ── */

  async function doShare() {
    if (!shareTarget) {
      toast.error("Elige el recuerdo que quieres compartir.");
      return;
    }
    if (sharePass.length < 8) {
      toast.error("La frase de partage necesita al menos 8 caracteres.");
      return;
    }
    if (sharePass !== shareConfirm) {
      toast.error("Las frases de partage no coinciden.");
      return;
    }
    setShareBusy(true);
    try {
      const file = await buildShareFile(shareTarget, sharePass, shareHint);
      download(shareFilename(shareTarget), JSON.stringify(file, null, 2), "application/json");
      toast.success("Archivo compartido descargado: envíaselo al receptor junto con la frase (por otro canal)", {
        duration: 8000,
      });
      setSharePass("");
      setShareConfirm("");
      setShareHint("");
    } catch {
      toast.error("No se pudo generar el archivo compartido.");
    } finally {
      setShareBusy(false);
    }
  }

  async function onShareFile(f: File) {
    setBusy(true);
    try {
      const data = JSON.parse(await f.text()) as { format?: string };
      if (data?.format !== "boveda.encrypted-share") {
        toast.error("No es una memoria compartida BÓVEDA (boveda-comparte-*.json).");
        return;
      }
      setPendingShare({ data, name: f.name });
      setShareOpenPass("");
    } catch {
      toast.error("El archivo compartido no es válido.");
    } finally {
      setBusy(false);
      if (shareFileRef.current) shareFileRef.current.value = "";
    }
  }

  async function doOpenShare() {
    if (!pendingShare) return;
    if (!shareOpenPass) {
      toast.error("Escribe la frase de partage que te dio quien lo envió.");
      return;
    }
    setShareOpenBusy(true);
    try {
      const r = await useBoveda.getState().importShareFile(pendingShare.data, shareOpenPass);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo importar el recuerdo compartido.");
        return;
      }
      toast.success(`Recuerdo compartido importado y re-cifrado con TU frase: «${r.title}»`, {
        duration: 7000,
      });
      setPendingShare(null);
      setShareOpenPass("");
    } finally {
      setShareOpenBusy(false);
    }
  }

  async function onRestore(id: string) {
    setConfirmRestoreId(null);
    setBackupBusy(true);
    try {
      const ok = await restoreBackup(id);
      if (ok) toast.success("Bóveda restaurada desde el respaldo");
      else toast.error("No se pudo restaurar el respaldo.");
    } finally {
      setBackupBusy(false);
    }
  }

  const restoreTarget = backups.find((b) => b.id === confirmRestoreId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-primary" aria-hidden />
              Llévate tu memoria
            </CardTitle>
            <CardDescription>
              El <strong className="text-foreground">paquete .zip</strong> comprime todo: formato
              abierto con hashes, Markdown legible y el paquete de continuación para una IA nueva.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportZip} className="gap-2">
                <FileArchive className="h-4 w-4" aria-hidden />
                Paquete .zip ({memories.length})
              </Button>
              <Button onClick={exportContinuation} variant="outline" className="gap-2">
                <ArrowLeftRight className="h-4 w-4" aria-hidden />
                Continuación .md
              </Button>
              <Button onClick={exportJson} variant="outline" className="gap-2">
                <FileJson className="h-4 w-4" aria-hidden />
                JSON
              </Button>
              <Button onClick={exportMarkdown} variant="outline" className="gap-2">
                <FileText className="h-4 w-4" aria-hidden />
                Markdown
              </Button>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground flex gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              {verifiedCount} de {memories.length} recuerdos están verificados y viajan con su hash SHA-256
              para que cualquier importador pueda comprobar que no se alteraron.
            </p>
            <p className="text-xs text-muted-foreground flex gap-2">
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              «Continuación .md» es el archivo para cuando se acaban los tokens: pégalo como primer
              mensaje en una conversación nueva — de la misma IA o de otra — y recupera tu contexto.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" aria-hidden />
              Trae memoria de otra bóveda
            </CardTitle>
            <CardDescription>
              Importa un <code className="text-xs bg-muted px-1 rounded">boveda-*.json</code> exportado
              desde otra instancia: el mismo formato, ida y vuelta garantizada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void onFile(f);
              }}
            >
              <ArrowLeftRight className="h-8 w-8 text-primary" aria-hidden />
              <span className="text-sm font-medium">Arrastra tu boveda-*.json</span>
              <span className="text-xs text-muted-foreground">Se abrirá el flujo de revisión habitual</span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Importar formato BÓVEDA"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      {/* ── Blindar metadatos (sello v2) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldOff className="h-4 w-4 text-primary" aria-hidden />
            Blindar metadatos
          </CardTitle>
          <CardDescription>
            Los recuerdos nuevos ya se guardan con el sello v2: tipo, origen, fechas y hash viajan
            DENTRO del cifrado y el servidor solo ve blobs opacos. Si tu bóveda trae recuerdos
            antiguos, mígralos aquí sin cambiar su contenido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-bold">{sealedCount}</span> de {memories.length} recuerdos
                están blindados.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {unsealed === 0
                  ? "Todo tu contenido sensible está dentro del cifrado."
                  : `${unsealed} recuerdos aún exponen metadatos en el sobre.`}
              </p>
            </div>
            {unsealed > 0 && (
              <Button onClick={onSealAll} disabled={sealBusy} className="gap-2 shrink-0">
                <Lock className="h-4 w-4" aria-hidden />
                Blindar ahora ({unsealed})
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            La migración re-cifra cada recuerdo en tu navegador con tu clave; el contenido no cambia
            y queda marcado con la insignia «Blindado» en Procedencia.
          </p>
        </CardContent>
      </Card>

      {/* ── Respaldos cifrados ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4 text-primary" aria-hidden />
            Respaldos cifrados
          </CardTitle>
          <CardDescription>
            Snapshots cifrados de tu bóveda. Antes de cada importación grande se crea uno
            automáticamente. Restaurar reemplaza la bóveda actual por el snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onCreateBackup} disabled={backupBusy} className="gap-2">
              <Archive className="h-4 w-4" aria-hidden />
              Crear respaldo ahora
            </Button>
            <Button onClick={downloadEncryptedSnapshot} disabled={backupBusy} variant="outline" className="gap-2">
              <Download className="h-4 w-4" aria-hidden />
              Descargar respaldo cifrado (.json)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => backupFileRef.current?.click()}
              disabled={busy || backupBusy}
            >
              <PackageOpen className="h-4 w-4" aria-hidden />
              Adoptar respaldo externo
            </Button>
            <input
              ref={backupFileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Adoptar archivo de respaldo cifrado"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onBackupFile(f);
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground flex gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            «Adoptar respaldo externo» restaura un archivo descargado en ESTE dispositivo — solo
            funciona con la bóveda vacía y se desbloquea con la frase original del respaldo. Así
            migras tu bóveda cifrada a otro equipo sin que nadie más pueda leerla.
          </p>

          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay respaldos guardados.</p>
          ) : (
            <ScrollArea className="max-h-64 rounded-xl border">
              <ul className="divide-y">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                        {new Date(b.createdAt).toLocaleString("es")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {b.count} recuerdos{b.note ? ` · ${b.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8"
                        onClick={() => setConfirmRestoreId(b.id)}
                        disabled={backupBusy}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Restaurar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteBackup(b.id)}
                        disabled={backupBusy}
                        aria-label={`Borrar respaldo del ${new Date(b.createdAt).toLocaleString("es")}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Compartir una memoria (frase propia) ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4 text-primary" aria-hidden />
              Compartir un recuerdo
            </CardTitle>
            <CardDescription>
              Empaqueta UNA memoria cifrada con una frase de partage propia — distinta de la frase de
              tu bóveda. El receptor la importa en su bóveda y queda re-cifrada con SU frase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-memory">Recuerdo a compartir</Label>
              <Select value={shareId} onValueChange={setShareId}>
                <SelectTrigger id="share-memory" aria-label="Elegir recuerdo para compartir">
                  <SelectValue placeholder="Elige un recuerdo…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {memories.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.plain.title.slice(0, 60)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="share-pass">Frase de partage</Label>
                <Input
                  id="share-pass"
                  type="password"
                  value={sharePass}
                  onChange={(e) => setSharePass(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-confirm">Confirma la frase</Label>
                <Input
                  id="share-confirm"
                  type="password"
                  value={shareConfirm}
                  onChange={(e) => setShareConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {sharePass.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fortaleza: <span className="text-foreground">{STRENGTHS[passphraseStrength(sharePass)]}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="share-hint">Pista para el receptor (opcional)</Label>
              <Input
                id="share-hint"
                value={shareHint}
                onChange={(e) => setShareHint(e.target.value)}
                placeholder="p. ej. «la frase que hablamos el martes»"
                maxLength={120}
              />
            </div>
            <Button onClick={doShare} disabled={shareBusy || memories.length === 0} className="gap-2">
              <Download className="h-4 w-4" aria-hidden />
              Descargar recuerdo compartido (.json)
            </Button>
            {shareTarget && (
              <p className="text-xs text-muted-foreground flex gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                Se compartirá: «{shareTarget.plain.title}». La frase de partage NUNCA va dentro del
                archivo: pásasela al receptor por otro canal.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRoundPlus className="h-4 w-4 text-primary" aria-hidden />
              Recibir un recuerdo compartido
            </CardTitle>
            <CardDescription>
              Carga un archivo <code className="text-xs bg-muted px-1 rounded">boveda-comparte-*.json</code> y
              ábrelo con la frase de partage que te dio quien lo envió. Se añadirá a TU bóveda,
              re-cifrado con tu propia frase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void onShareFile(f);
              }}
            >
              <Share2 className="h-8 w-8 text-primary" aria-hidden />
              <span className="text-sm font-medium">Arrastra tu boveda-comparte-*.json</span>
              <span className="text-xs text-muted-foreground">
                Se pedirá la frase de partage antes de importar
              </span>
              <input
                ref={shareFileRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Importar recuerdo compartido cifrado"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onShareFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      {/* ── El contrato del formato ── */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-primary" aria-hidden />
            El contrato: qué ve el servidor (y qué no)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1 border-emerald-600/40 text-emerald-500">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Cifrado (invisible para el servidor)
            </Badge>
            <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside leading-relaxed">
              <li>Títulos y contenidos de cada recuerdo</li>
              <li>Etiquetas, confianza y los respaldos completos</li>
              <li>La frase y la clave: nunca salen del navegador</li>
              <li>En recuerdos blindados: también su tipo, origen, fechas y hash</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Info className="h-3 w-3" aria-hidden />
              Sobre en claro (metadatos mínimos)
            </Badge>
            <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside leading-relaxed">
              <li>Tamaño del blob y fechas del sobre</li>
              <li>En recuerdos blindados: SOLO marcadores opacos (kind/source = «seal»)</li>
              <li>En recuerdos sin blindar: tipo, origen y hash declarados — mígralos arriba</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Confirmación de restauración */}
      <AlertDialog open={confirmRestoreId !== null} onOpenChange={(v) => !v && setConfirmRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar este respaldo?</AlertDialogTitle>
            <AlertDialogDescription>
              La bóveda actual ({memories.length} recuerdos) se reemplazará por el snapshot del{" "}
              {restoreTarget ? new Date(restoreTarget.createdAt).toLocaleString("es") : ""} (
              {restoreTarget?.count ?? 0} recuerdos). Los recuerdos añadidos después del respaldo se
              perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onRestore(confirmRestoreId!)} className="bg-primary text-primary-foreground">
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de adopción de respaldo externo */}
      <AlertDialog open={pendingFile !== null} onOpenChange={(v) => !v && setPendingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adoptar respaldo cifrado</AlertDialogTitle>
            <AlertDialogDescription>
              Este archivo contiene {pendingFile?.count ?? 0} recuerdos cifrados y el material
              criptográfico de su bóveda original. Se reemplazará cualquier bóveda local y, al
              terminar, deberás desbloquear con la FRASE ORIGINAL de ese respaldo. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doImportBackupFile()} className="bg-primary text-primary-foreground">
              Adoptar respaldo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Frase de partage para abrir un recuerdo compartido */}
      <AlertDialog open={pendingShare !== null} onOpenChange={(v) => !v && setPendingShare(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abrir recuerdo compartido</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingShare?.name ?? ""}» está cifrado con la frase de partage de quien lo envió.
              Escríbela para descifrarlo localmente: se importará re-cifrado con TU frase y su
              origen quedará registrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="share-open-pass">Frase de partage</Label>
            <Input
              id="share-open-pass"
              type="password"
              value={shareOpenPass}
              onChange={(e) => setShareOpenPass(e.target.value)}
              placeholder="La que te dio el emisor"
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void doOpenShare();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doOpenShare();
              }}
              disabled={shareOpenBusy || !shareOpenPass}
              className="bg-primary text-primary-foreground"
            >
              Descifrar e importar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
