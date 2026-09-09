import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const isEmbeddedBuild = import.meta.env.MODE === "yandex" || import.meta.env.MODE === "web";
  const history = isEmbeddedBuild ? createMemoryHistory({ initialEntries: ["/"] }) : undefined;

  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
