import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import brandMark from "../assets/brand/rune-rating.svg";
import primitivesCss from "../components/primitives/primitives.css?url";
import { RouteMessage } from "../components/RouteMessage";
import scoreboardCss from "../styles/scoreboard.css?url";
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
        content: "#071012",
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
        rel: "stylesheet",
        href: scoreboardCss,
      },
      { rel: "stylesheet", href: primitivesCss },
      {
        rel: "icon",
        href: brandMark,
        type: "image/svg+xml",
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
        <div className="rr-app-root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootErrorComponent() {
  return (
    <RootDocument>
      <RouteMessage
        eyebrow="Something went wrong"
        title="RuneRating could not load this page."
        allowReload
      >
        Try refreshing the page or start a new comparison.
      </RouteMessage>
    </RootDocument>
  );
}

function RootNotFoundComponent() {
  return (
    <RouteMessage
      eyebrow="Not found"
      title="This RuneRating page does not exist."
    >
      Check the URL or start from the default comparison page.
    </RouteMessage>
  );
}
