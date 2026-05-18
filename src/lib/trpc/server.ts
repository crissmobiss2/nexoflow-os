import "server-only";
import { createTRPCProxyClient, loggerLink, TRPCClientError } from "@trpc/client";
import { callProcedure } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { type TRPCErrorResponse } from "@trpc/server/rpc";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { appRouter } from "@/server/routers";
import { createTRPCContext } from "@/server/trpc";
import type { AppRouter } from "@/server/routers";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ req: { headers: heads } as any });
});

export const api = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    loggerLink({ enabled: (op) => process.env.NODE_ENV === "development" }),
    () =>
      ({ op }) =>
        observable((observer) => {
          createContext()
            .then((ctx) =>
              callProcedure({
                procedures: appRouter._def.procedures,
                path: op.path,
                rawInput: op.input,
                ctx,
                type: op.type,
              }),
            )
            .then((data) => {
              observer.next({ result: { data } });
              observer.complete();
            })
            .catch((cause: TRPCErrorResponse) => {
              observer.error(TRPCClientError.from(cause));
            });
        }),
  ],
});
