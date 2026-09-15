import { createFileRoute } from "@tanstack/react-router";
import { loadRatingOgModel } from "../../../features/og/data";
import { ratingImageResponse } from "../../../features/og/render";

export const Route = createFileRoute("/og/rating/$rsn")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const model = await loadRatingOgModel(params.rsn);
        return ratingImageResponse(model, {
          origin: new URL(request.url).origin,
        });
      },
    },
  },
});
