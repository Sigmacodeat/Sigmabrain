"use client";

import { useState } from "react";
import { Scale, X, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateRvg } from "@/lib/rvg";

export default function RvgDialog() {
  const [open, setOpen] = useState(false);
  const [streitwert, setStreitwert] = useState("");
  const [result, setResult] = useState<ReturnType<typeof calculateRvg> | null>(null);

  function compute() {
    const val = parseFloat(streitwert);
    if (val > 0) setResult(calculateRvg(val));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] text-xs text-[#8888aa] hover:text-[#e8e8f0] hover:border-[#3a3a6a] transition-all"
      >
        <Scale size={14} />
        RVG-Rechner
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a] shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-emerald-400" />
                <h2 className="text-lg font-bold text-[#e8e8f0]">RVG-Rechner</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#8a8aa8] hover:text-[#e8e8f0]">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#8888aa]">
              Gebührenberechnung nach § 13 RVG (Rechtsanwaltsvergütungsgesetz).
              Inkl. Verfahrensgebühr (1,3), Terminsgebühr (1,2), Einigungsgebühr (1,5) und Auslagenpauschale.
            </p>

            <div className="flex gap-2">
              <input
                type="number"
                value={streitwert}
                onChange={(e) => setStreitwert(e.target.value)}
                placeholder="Streitwert in €"
                className="flex-1 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-emerald-500/50"
                onKeyDown={(e) => e.key === "Enter" && compute()}
              />
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-sm"
                onClick={compute}
              >
                <Calculator size={14} />
                Berechnen
              </Button>
            </div>

            {result && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8888aa]">Streitwert</span>
                  <span className="text-[#e8e8f0] font-medium">{result.streitwert.toLocaleString("de-DE")} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8888aa]">Basisgebühr (1,0)</span>
                  <span className="text-[#e8e8f0]">{result.basisGebuehr.toFixed(2)} €</span>
                </div>
                <div className="border-t border-[#1e1e3a] pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#8888aa]">Verfahrensgebühr (1,3)</span>
                    <span className="text-[#e8e8f0]">{result.verfahrensgebuehr.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8888aa]">Terminsgebühr (1,2)</span>
                    <span className="text-[#e8e8f0]">{result.terminsgebuehr.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8888aa]">Einigungsgebühr (1,5)</span>
                    <span className="text-[#e8e8f0]">{result.einigungsgebuehr.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8888aa]">Auslagenpauschale</span>
                    <span className="text-[#e8e8f0]">{result.auslagenpauschale.toFixed(2)} €</span>
                  </div>
                </div>
                <div className="border-t border-[#1e1e3a] pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#8888aa]">Summe netto</span>
                    <span className="text-[#e8e8f0] font-medium">{result.summeNetto.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8888aa]">MwSt (19%)</span>
                    <span className="text-[#e8e8f0]">{result.mwst.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Summe brutto</span>
                    <span>{result.summeBrutto.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
