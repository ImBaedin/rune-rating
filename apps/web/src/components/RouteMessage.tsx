import { fallbackCompareRsns } from "../exampleRsns";
import { comparisonPath } from "../features/comparison/navigation";

export function RouteMessage({
  eyebrow,
  title,
  children,
  allowReload = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  allowReload?: boolean;
}) {
  return (
    <main className="route-message">
      <section>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{children}</p>
        <RouteRecoveryActions allowReload={allowReload} />
      </section>
    </main>
  );
}

function RouteRecoveryActions({
  allowReload = false,
}: {
  allowReload?: boolean;
}) {
  // Full-page navigation also recovers from a failed client-side router.
  return (
    <nav className="route-recovery-actions" aria-label="Page recovery">
      {allowReload ? (
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      ) : null}
      <a href="/">Go home</a>
      <a href={comparisonPath("overview", fallbackCompareRsns)}>
        Open sample comparison
      </a>
    </nav>
  );
}
