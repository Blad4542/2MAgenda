export default function AgendaLoading() {
  const cols = 6;
  const rows = 12;

  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* Date nav bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="h-5 w-56 bg-gray-200 rounded-lg" />
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 bg-gray-100 rounded-lg" />
          <div className="w-14 h-7 bg-gray-100 rounded-lg" />
          <div className="w-7 h-7 bg-gray-100 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar sidebar */}
        <div className="hidden lg:flex flex-col items-center p-4 bg-gray-50 border-r border-gray-200 shrink-0">
          <div className="w-[270px] h-[280px] bg-gray-200 rounded-xl" />
        </div>

        {/* Grid skeleton */}
        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-max rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className={`grid grid-cols-[72px_repeat(${cols},minmax(120px,1fr))] bg-gray-50 border-b border-gray-200`}>
              <div className="py-3 px-2 flex justify-center">
                <div className="h-3 w-8 bg-gray-200 rounded" />
              </div>
              {[...Array(cols)].map((_, i) => (
                <div key={i} className="py-3 px-2 flex justify-center border-l border-gray-200">
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            {[...Array(rows)].map((_, r) => (
              <div key={r} className={`grid grid-cols-[72px_repeat(${cols},minmax(120px,1fr))] border-b border-gray-100 ${r % 2 ? "bg-white" : "bg-gray-50/30"}`}>
                <div className="py-3 px-2 flex justify-center">
                  <div className="h-3 w-10 bg-gray-100 rounded" />
                </div>
                {[...Array(cols)].map((_, c) => (
                  <div key={c} className="border-l border-gray-100" style={{ minHeight: "3.25rem" }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
