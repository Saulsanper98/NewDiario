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
          {/* Actions row */}
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="flex gap-2">
              <div className="skeleton h-8 w-28 rounded-lg" />
              <div className="skeleton h-8 w-32 rounded-lg" />
            </div>
          </div>

          {/* Filter bar */}
          <div className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div className="skeleton h-8 flex-1 min-w-40 rounded-lg" />
            <div className="skeleton h-7 w-28 rounded-lg shrink-0" />
            <div className="skeleton h-7 w-28 rounded-lg shrink-0" />
            <div className="skeleton h-7 w-24 rounded-lg shrink-0" />
          </div>

          {/* Shift group header */}
          <div className="flex items-center gap-3">
            <div className="skeleton w-4 h-4 rounded shrink-0" />
            <div className="skeleton h-3 w-36 rounded" />
            <div className="flex-1 h-px bg-white/5 rounded" />
          </div>

          {/* Log entry cards */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-4 flex items-start gap-4">
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
          ))}
        </div>
      </div>
    </div>
  );
}
