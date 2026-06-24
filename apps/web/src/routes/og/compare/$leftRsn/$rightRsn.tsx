import { createFileRoute } from "@tanstack/react-router";
import { loadCompareOgModel } from "../../../../features/og/data";
import { compareImageResponse } from "../../../../features/og/render";

export const Route = createFileRoute("/og/compare/$leftRsn/$rightRsn")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const model = await loadCompareOgModel(params.leftRsn, params.rightRsn);
        return compareImageResponse(model, {
          origin: new URL(request.url).origin,
        });
      },
    },
  },
});
