import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/routers";
import { createTRPCContext } from "@/server/trpc";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on ${path ?? "<no-path>"}:`, error.message, error.cause);
    },
  });

export { handler as GET, handler as POST };
