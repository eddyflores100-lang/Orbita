"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, TriangleAlert, Eye, EyeOff, PackageOpen, Loader2 } from "lucide-react";
import { passphraseStrength } from "@/lib/crypto";
import { useBoveda, type EncryptedBackupFile } from "@/lib/store";
import { toast } from "sonner";

const STRENGTH_LABEL = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Excelente"];

function PassFields({
  mode,
  pass,
  setPass,
  confirm,
  setConfirm,
  show,
  setShow,
}: {
  mode: "create" | "unlock";
  pass: string;
  setPass: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
}) {
  const strength = passphraseStrength(pass);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pass">Frase de bóveda</Label>
        <div className="relative">
          <Input
            id="pass"
            type={show ? "text" : "password"}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder={mode === "create" ? "p. ej. seis caballos grises suben al ático" : "Tu frase de bóveda"}
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.form?.requestSubmit();
            }}
          />
          <button
            type="button"
            aria-label={show ? "Ocultar frase" : "Mostrar frase"}
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {mode === "create" && pass.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    strength > i
                      ? strength >= 3
                        ? "bg-emerald-500"
                        : strength === 2
                          ? "bg-amber-500"
                          : "bg-red-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Fortaleza: <span className="text-foreground">{STRENGTH_LABEL[strength]}</span>
              {strength < 3 && " — usa una frase larga con mayúsculas, números y símbolos"}
            </p>
          </div>
        )}
      </div>
      {mode === "create" && (
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirma la frase</Label>
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.form?.requestSubmit();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CreateVaultDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createVault = useBoveda((s) => s.createVault);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (pass.length < 8) {
      setLocalError("La frase necesita al menos 8 caracteres. Es tu única llave.");
      return;
    }
    if (pass !== confirm) {
      setLocalError("Las frases no coinciden.");
      return;
    }
    const ok = await createVault(pass);
    if (ok) {
      setPass("");
      setConfirm("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden /> Crea tu bóveda
          </DialogTitle>
          <DialogDescription>
            Tu frase deriva la clave con PBKDF2 (310.000 iteraciones) dentro de tu navegador.{" "}
            <strong className="text-foreground">No hay recuperación</strong>: si la pierdes, la bóveda no se abre.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <PassFields
            mode="create"
            pass={pass}
            setPass={setPass}
            confirm={confirm}
            setConfirm={setConfirm}
            show={show}
            setShow={setShow}
          />
          {localError && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full">
            Forjar mi bóveda
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnlockDialog() {
  const unlock = useBoveda((s) => s.unlock);
  const error = useBoveda((s) => s.error);
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pass) return;
    const ok = await unlock(pass);
    if (ok) setPass("");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 vault-grid">
      <div className="w-full max-w-md space-y-6 py-16">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl border-2 border-primary/40 flex items-center justify-center bg-primary/5">
            <KeyRound className="h-8 w-8 text-primary" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tu bóveda te espera</h1>
          <p className="text-sm text-muted-foreground">
            Introduce tu frase para derivar la clave en tu navegador. El servidor solo tiene texto cifrado.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 bg-card border rounded-xl p-6 shadow-lg">
          <PassFields mode="unlock" pass={pass} setPass={setPass} confirm="" setConfirm={() => {}} show={show} setShow={setShow} />
          {error && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full">
            Abrir la bóveda
          </Button>
        </form>
      </div>
    </main>
  );
}

export function LockScreen() {
  return <UnlockDialog />;
}

/**
 * Migración entre dispositivos: adopta un respaldo cifrado descargado en
 * OTRO equipo. Recrea aquí la bóveda con el material criptográfico ORIGINAL
 * del archivo y queda bloqueada hasta introducir la frase original.
 */
export function AdoptVaultDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const importBackupFile = useBoveda((s) => s.importBackupFile);
  const [pending, setPending] = useState<EncryptedBackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onFile(f: File) {
    setLocalError(null);
    try {
      const data = JSON.parse(await f.text()) as EncryptedBackupFile;
      if (data?.format !== "boveda.encrypted-backup" || !data.vault?.salt) {
        setLocalError("Este archivo no es un respaldo cifrado BÓVEDA (boveda-respaldo-*.json).");
        return;
      }
      setPending(data);
    } catch {
      setLocalError("El archivo no se pudo leer: ¿es el JSON correcto?");
    }
  }

  async function doAdopt() {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await importBackupFile(pending);
      if (!r.ok) {
        setLocalError(r.error ?? "No se pudo adoptar el respaldo.");
        return;
      }
      toast.success(
        `Bóveda migrada: ${r.count} recuerdos esperando. Desbloquéala con la frase ORIGINAL del respaldo.`,
        { duration: 9000 },
      );
      setPending(null);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setPending(null);
          setLocalError(null);
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-primary" aria-hidden /> Migro desde otro dispositivo
          </DialogTitle>
          <DialogDescription>
            Carga el <code className="text-xs bg-muted px-1 rounded">boveda-respaldo-*.json</code> que
            descargaste en tu otro equipo. La bóveda se reconstruye aquí idéntica, cifrada con el
            material ORIGINAL: después la abres con tu frase de siempre.
          </DialogDescription>
        </DialogHeader>

        {!pending ? (
          <label
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
          >
            <PackageOpen className="h-8 w-8 text-primary" aria-hidden />
            <span className="text-sm font-medium">Arrastra tu boveda-respaldo-*.json</span>
            <span className="text-xs text-muted-foreground">Nada se descifra todavía: solo se verifica el formato</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Cargar respaldo cifrado para migrar"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <p className="text-sm font-medium">Respaldo verificado</p>
              <p className="text-sm text-muted-foreground">
                {pending.count} recuerdos cifrados · creado{" "}
                {new Date(pending.createdAt).toLocaleString("es")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Se reemplazará cualquier bóveda local y, al terminar, la app quedará bloqueada.
              Ábrela con la frase ORIGINAL de ese respaldo.
            </p>
            <Button onClick={() => void doAdopt()} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PackageOpen className="h-4 w-4" aria-hidden />}
              {busy ? "Reconstruyendo bóveda…" : "Adoptar respaldo y migrar"}
            </Button>
          </div>
        )}

        {localError && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
