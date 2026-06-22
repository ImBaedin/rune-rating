import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import appCss from "../styles.css?url";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "theme-color",
        content: "#f3f5f7",
      },
      {
        title: "RuneRating Comparison",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2317212a'/%3E%3Cpath d='M8 8h12l4 5-6 4 5 7h-6l-5-7H8V8zm5 4v2h6l-2-2h-4z' fill='%23ffffff'/%3E%3C/svg%3E",
      },
    ],
  }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      {convex ? (
        <ConvexProvider client={convex}>
          <Outlet />
        </ConvexProvider>
      ) : (
        <div className="setup-message">
          Set <code>VITE_CONVEX_URL</code> to connect the comparison UI.
        </div>
      )}
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootErrorComponent() {
  return (
    <RootDocument>
      <main className="route-message">
        <section>
          <p className="eyebrow">Something went wrong</p>
          <h1>RuneRating could not load this page.</h1>
          <p>Try refreshing the page or start a new comparison.</p>
        </section>
      </main>
    </RootDocument>
  );
}

function RootNotFoundComponent() {
  return (
    <main className="route-message">
      <section>
        <p className="eyebrow">Not found</p>
        <h1>This RuneRating page does not exist.</h1>
        <p>Check the URL or start from the default comparison page.</p>
      </section>
    </main>
  );
}
