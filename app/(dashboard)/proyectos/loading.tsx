export default function ProyectosLoading() {
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
        <div className="p-6 max-w-6xl mx-auto space-y-5">
          {/* Page heading */}
          <div className="flex items-center justify-between">
            <div className="skeleton h-7 w-32 rounded-lg" />
            <div className="skeleton h-9 w-36 rounded-lg" />
          </div>

          {/* Filter bar */}
          <div className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div className="skeleton h-8 flex-1 min-w-40 rounded-lg" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-7 w-20 rounded-lg shrink-0" />
            ))}
            <div className="skeleton h-7 w-16 rounded-lg ml-auto" />
          </div>

          {/* Project grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 space-y-3 flex flex-col">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-5 w-16 rounded-md" />
                  <div className="skeleton h-5 w-12 rounded-md" />
                </div>
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="skeleton h-3 w-20 rounded" />
                    <div className="skeleton h-3 w-8 rounded" />
                  </div>
                  <div className="skeleton h-1.5 w-full rounded-full" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/6">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton w-5 h-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
