export default function TraspasoLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header skeleton */}
      <div className="h-16 app-top-header flex items-center gap-4 px-6 shrink-0">
        <div className="skeleton h-4 w-36 rounded" />
        <div className="flex-1" />
        <div className="skeleton h-7 w-32 rounded-lg" />
        <div className="skeleton w-8 h-8 rounded-lg" />
        <div className="skeleton w-8 h-8 rounded-full" />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-5">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="skeleton h-7 w-48 rounded-lg" />
              <div className="skeleton h-4 w-60 rounded" />
            </div>
            <div className="skeleton h-9 w-36 rounded-lg" />
          </div>

          {/* Shift counters */}
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-5 flex flex-col items-center gap-2">
                <div className="skeleton w-6 h-6 rounded" />
                <div className="skeleton h-8 w-8 rounded" />
                <div className="skeleton h-3 w-28 rounded" />
              </div>
            ))}
          </div>

          {/* Recent logs card */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="skeleton h-4 w-48 rounded" />
              <div className="skeleton h-5 w-8 rounded-md" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="skeleton w-7 h-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="skeleton h-3.5 w-48 rounded" />
                    <div className="skeleton h-4 w-16 rounded-md" />
                  </div>
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Shift tasks card */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="skeleton h-4 w-40 rounded" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3">
                <div className="skeleton w-2 h-2 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="skeleton h-3.5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
                <div className="skeleton h-5 w-14 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
