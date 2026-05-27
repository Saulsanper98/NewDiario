/**
 * Esqueleto de carga para `/bitacora/*`. Replica el layout real (hero + KPI
 * strip + agrupación por turno con bordes de color) para que el cambio entre
 * estado loading y datos sea menos disruptivo.
 *
 * Funciona en tema claro y oscuro: el skeleton CSS global (`.skeleton`) se
 * adapta automáticamente al data-theme del documento.
 */

const SHIFT_TINTS = [
  "border-l-amber-400/55",
  "border-l-orange-400/55",
  "border-l-indigo-400/55",
];

const TYPE_TINTS = [
  "border-l-red-500/65",
  "border-l-orange-500/55",
  "border-l-sky-500/55",
  "border-l-violet-500/55",
  "border-l-red-500/65",
  "border-l-orange-500/55",
];

export default function BitacoraLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header skeleton */}
      <div className="h-16 app-top-header flex items-center gap-4 px-6 shrink-0">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="flex-1" />
        <div className="skeleton h-7 w-32 rounded-lg" />
        <div className="skeleton w-8 h-8 rounded-lg" />
        <div className="skeleton w-8 h-8 rounded-full" />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          {/* Hero */}
          <div className="rounded-2xl border border-white/8 dark:border-white/10 bg-white/[0.03] px-5 py-5 sm:px-7 sm:py-6 relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="skeleton h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="skeleton h-3 w-40 rounded" />
                <div className="skeleton h-6 w-56 rounded" />
                <div className="skeleton h-3 w-72 rounded" />
              </div>
              <div className="skeleton h-9 w-36 rounded-xl shrink-0" />
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 flex items-start justify-between"
              >
                <div className="space-y-1.5">
                  <div className="skeleton h-2.5 w-16 rounded" />
                  <div className="skeleton h-6 w-10 rounded" />
                </div>
                <div className="skeleton h-7 w-7 rounded-lg" />
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div className="skeleton h-8 w-24 rounded-lg shrink-0" />
            <div className="skeleton h-8 flex-1 min-w-40 rounded-lg" />
            <div className="skeleton h-8 w-8 rounded-md" />
            <div className="skeleton h-8 w-8 rounded-md" />
          </div>

          {/* Grupos por turno con cards con borde por tipo */}
          {SHIFT_TINTS.map((shiftCls, gi) => (
            <div key={gi} className="space-y-3 pt-2">
              {/* Group header */}
              <div className="flex items-center gap-3">
                <div className="skeleton w-3.5 h-3.5 rounded shrink-0" />
                <div className="skeleton h-3 w-28 rounded" />
                <div className="skeleton h-2 w-2 rounded-full" />
                <div className="skeleton h-3 w-24 rounded" />
                <div className="flex-1 h-px bg-white/[0.06] rounded ml-2" />
              </div>

              {/* Cards */}
              {[0, 1].map((j) => {
                const idx = (gi * 2 + j) % TYPE_TINTS.length;
                return (
                  <div
                    key={j}
                    className={`glass rounded-xl p-5 flex items-start gap-4 border-l-[4px] ${shiftCls} ${TYPE_TINTS[idx]}`}
                    style={{
                      animation: "card-slide-in 0.45s ease-out both",
                      animationDelay: `${(gi * 2 + j) * 45}ms`,
                    }}
                  >
                    <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="skeleton h-4 w-52 rounded" />
                        <div className="skeleton h-5 w-20 rounded-md" />
                      </div>
                      <div className="skeleton h-3 w-full rounded" />
                      <div className="skeleton h-3 w-4/5 rounded" />
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-3 w-24 rounded" />
                        <div className="skeleton h-3 w-16 rounded" />
                        <div className="skeleton h-3 w-20 rounded" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
