import { PageHeader } from "./ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      <PageHeader tag="404" title="Page not found" color="gyellow">
        This link doesn't match any page. It may have moved, or there may be a typo in the address.
      </PageHeader>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="#" className="hard-button inline-block bg-gyellow px-5 py-2.5 font-display font-bold">
          Go to the homepage
        </a>
        <a href="#/events" className="hard-button inline-block bg-bg px-5 py-2.5 font-display font-bold">
          Browse events
        </a>
        <a href="#/dashboard" className="hard-button inline-block bg-bg px-5 py-2.5 font-display font-bold">
          Your dashboard
        </a>
      </div>
    </main>
  );
}
