export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full overflow-auto">
      {/* Greeting skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-7 w-56 rounded-lg" />
          <div className="skeleton h-4 w-72 rounded-md" />
        </div>
        <div className="skeleton h-9 w-36 rounded-lg" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="skeleton w-9 h-9 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-5 w-8 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 lg:col-span-2 space-y-3">
          <div className="skeleton h-4 w-40 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="skeleton w-7 h-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="skeleton h-4 w-28 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3 p-3.5 rounded-xl border border-white/6">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-1.5 w-full rounded-full" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
