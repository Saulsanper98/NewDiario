export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0 animate-pulse p-6 space-y-4">
      <div className="h-7 w-48 rounded-lg bg-white/8 shrink-0" />
      <div className="h-10 w-full max-w-xl rounded-xl bg-white/5 shrink-0" />
      <div className="glass rounded-xl h-36 border-white/5 shrink-0" />
      <div className="glass rounded-xl h-28 border-white/5 shrink-0" />
      <div className="glass rounded-xl h-28 border-white/5 shrink-0" />
    </div>
  );
}
