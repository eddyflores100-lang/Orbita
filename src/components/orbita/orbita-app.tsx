"use client";

import { useCallback, useEffect, useState } from "react";
import { orbitApi, type OrbitPropertyDTO } from "@/lib/orbita/api";
import OrbitaLanding from "./landing";
import PropertiesPanel from "./properties-panel";
import PropertyWorkspace from "./workspace";
import { Loader2 } from "lucide-react";

type View =
  | { screen: "landing" }
  | { screen: "properties" }
  | { screen: "property"; id: string };

export default function OrbitaApp() {
  const [view, setView] = useState<View>({ screen: "landing" });
  const [properties, setProperties] = useState<OrbitPropertyDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { properties } = await orbitApi.listProperties();
      setProperties(properties);
    } catch {
      /* silencio en primer arranque */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setBooted(true));
  }, [refresh]);

  return (
    <div className="orbita-root min-h-screen flex flex-col bg-[#07080d] text-[#ecebf4]">
      <header className="sticky top-0 z-40 border-b border-[rgba(167,139,250,0.14)] bg-[#07080d]/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => setView({ screen: "landing" })}
            className="flex items-center gap-2.5 group"
            aria-label="Ir al inicio de ÓRBITA"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
              <span className="absolute inset-0 rounded-full border border-cyan-300/30 scale-110 group-hover:scale-125 transition-transform" />
            </span>
            <span className="font-bold tracking-[0.22em] text-sm text-violet-200">ÓRBITA</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-[#8f8b9f] border border-[rgba(167,139,250,0.2)] rounded-full px-2 py-0.5">
              Property Content Engine
            </span>
          </button>
          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setView({ screen: "properties" })}
              className="rounded-md px-3 py-1.5 text-violet-200 hover:bg-violet-500/10 transition-colors"
            >
              Propiedades
            </button>
            <a
              href="/boveda"
              className="hidden sm:inline rounded-md px-3 py-1.5 text-[#8f8b9f] hover:text-violet-200 hover:bg-violet-500/10 transition-colors"
            >
              BÓVEDA
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {!booted ? (
          <div className="flex items-center justify-center py-32 text-[#8f8b9f]">
            <Loader2 className="h-6 w-6 animate-spin mr-3" /> Cargando ÓRBITA…
          </div>
        ) : view.screen === "landing" ? (
          <OrbitaLanding
            onEnter={() => setView({ screen: "properties" })}
            hasProperties={properties.length > 0}
          />
        ) : view.screen === "properties" ? (
          <PropertiesPanel
            properties={properties}
            loading={loading}
            onRefresh={refresh}
            onOpen={(id) => setView({ screen: "property", id })}
          />
        ) : (
          <PropertyWorkspace propertyId={view.id} onBack={() => { setView({ screen: "properties" }); void refresh(); }} />
        )}
      </main>

      <footer className="mt-auto border-t border-[rgba(167,139,250,0.14)] bg-[#07080d]">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8f8b9f]">
          <span>
            ÓRBITA v1 · Property Content Engine — una propiedad entra una vez, salen video, micrositio, QR y
            analytics.
          </span>
          <span className="flex items-center gap-3">
            <a href="/boveda" className="hover:text-violet-200 transition-colors">
              BÓVEDA
            </a>
            <span className="text-[#3d3b4a]">|</span>
            <span>AliceLabs</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
