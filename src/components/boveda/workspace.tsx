"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Vault,
  Lock,
  Database,
  FileUp,
  ArrowLeftRight,
  Fingerprint,
  Trash2,
  Sun,
  Moon,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useBoveda } from "@/lib/store";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import MemoriesTab from "./memories-tab";
import ImportTab from "./import-tab";
import PortabilityTab from "./portability-tab";
import ProvenanceTab from "./provenance-tab";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // evita parpadeo de hidratación
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Cambiar tema" onClick={() => setMounted(true)}>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default function Workspace() {
  const memories = useBoveda((s) => s.memories);
  const lock = useBoveda((s) => s.lock);
  const wipe = useBoveda((s) => s.wipe);

  return (
    <>
      {/* ── Cabecera del workspace ── */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <Vault className="h-5 w-5 text-primary" aria-hidden />
              <span className="font-black tracking-tight">BÓVEDA</span>
            </div>
            <Badge variant="outline" className="gap-1.5 border-emerald-600/40 text-emerald-500 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              Abierta · E2E
            </Badge>
            <span className="hidden sm:inline text-sm text-muted-foreground truncate">
              {memories.length} {memories.length === 1 ? "recuerdo" : "recuerdos"} cifrados
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={lock} className="gap-2">
              <Lock className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Bloquear</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Destruir la bóveda" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Destruir la bóveda por completo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borrará el registro de la bóveda y todos los blobs cifrados del servidor. Es
                    irreversible: sin tu frase ni el registro, no queda nada que descifrar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Conservar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      toast.success("Bóveda destruida. El servidor no conserva nada.");
                      void wipe();
                    }}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Destruir todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* ── Contenido por pestañas ── */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="memorias" className="w-full">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex h-auto gap-1 mb-6">
            <TabsTrigger value="memorias" className="gap-1.5 py-2" aria-label="Memorias">
              <Database className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Memorias</span>
            </TabsTrigger>
            <TabsTrigger value="importar" className="gap-1.5 py-2" aria-label="Importar">
              <FileUp className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Importar</span>
            </TabsTrigger>
            <TabsTrigger value="portabilidad" className="gap-1.5 py-2" aria-label="Portabilidad">
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Portabilidad</span>
            </TabsTrigger>
            <TabsTrigger value="procedencia" className="gap-1.5 py-2" aria-label="Procedencia">
              <Fingerprint className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Procedencia</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="memorias">
            <MemoriesTab />
          </TabsContent>
          <TabsContent value="importar">
            <ImportTab />
          </TabsContent>
          <TabsContent value="portabilidad">
            <PortabilityTab />
          </TabsContent>
          <TabsContent value="procedencia">
            <ProvenanceTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>BÓVEDA MVP v0.1 — tu memoria, con dueño.</p>
          <p className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 hidden" aria-hidden />
            El servidor solo almacena AES-GCM y sobres: nada en claro.
          </p>
        </div>
      </footer>
    </>
  );
}
