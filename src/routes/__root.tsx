import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useLocale, useMessages } from "@/lib/i18n";

import appCss from "../styles.css?url";

const isYandexBuild = import.meta.env.MODE === "yandex";
const previewImageUrl =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1e2bf9da-6f44-407c-90a3-e06d2c60484a/id-preview-04c848a4--35e87f47-2309-49bc-a61a-973b9fbd8342.lovable.app-1778240684801.png";

function NotFoundComponent() {
  const messages = useMessages();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{messages.notFoundTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{messages.notFoundBody}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {messages.goHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const messages = useMessages();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.errorTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{messages.errorBody}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {messages.tryAgain}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {messages.goHome}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tile turf" },
      {
        name: "description",
        content:
          "Interactive isometric grid game with player movement, painting mechanics, and mobile controls.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Tile turf" },
      {
        property: "og:description",
        content:
          "Interactive isometric grid game with player movement, painting mechanics, and mobile controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Tile turf" },
      {
        name: "twitter:description",
        content:
          "Interactive isometric grid game with player movement, painting mechanics, and mobile controls.",
      },
      ...(isYandexBuild
        ? []
        : [
            {
              property: "og:image",
              content: previewImageUrl,
            },
            {
              name: "twitter:image",
              content: previewImageUrl,
            },
          ]),
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  return (
    <html lang={locale}>
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
