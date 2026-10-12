// Placeholder for the first deploy (Phase 1, step 1). Ledger content will be
// rendered from spec/ledger-spec.json, never hardcoded here.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Spouse Ledger</h1>
        <p className="text-base opacity-80">
          Private beta. Sign-in is coming soon.
        </p>
      </main>
      <footer className="px-4 py-4 text-center text-xs opacity-60">
        Beta: legal notices pending attorney review
      </footer>
    </div>
  );
}
