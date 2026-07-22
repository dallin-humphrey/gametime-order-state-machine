export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <span className="inline-block rounded-full border border-line px-3 py-1 text-xs uppercase tracking-widest text-brand">
        Gametime Take-Home
      </span>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-50">
        Order State Machine
      </h1>
      <p className="mt-3 text-neutral-400">
        Phase 0 scaffold. The list + detail UI lands in Phase 5. See{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-brand">
          docs/plans/order-state-machine-plan.md
        </code>{" "}
        for the design.
      </p>
    </main>
  );
}
