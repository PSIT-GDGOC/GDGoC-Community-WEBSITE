import { PageHeader } from "./ui";

const GITHUB = "https://github.com/PSIT-GDGOC";

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      <PageHeader tag="Projects" title="What we're building" color="gred">
        Community-built projects, the tech behind them and how to contribute.
      </PageHeader>

      <section className="mt-10 max-w-xl border-[3px] border-ink bg-bg p-6 shadow-[6px_6px_0_var(--color-ink)]">
        <h2 className="font-display text-xl font-extrabold">The showcase is coming soon</h2>
        <p className="mt-2 text-muted">
          Projects will be listed here once the team publishes them. Until then, every repository the chapter maintains is
          open on GitHub.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="hard-button inline-block bg-gyellow px-5 py-2.5 font-display font-bold"
          >
            Browse our GitHub ↗
          </a>
          <a href="#/events" className="hard-button inline-block bg-bg px-5 py-2.5 font-display font-bold">
            Upcoming events
          </a>
        </div>
      </section>
    </main>
  );
}
