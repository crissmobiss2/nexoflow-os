import { initTRPC } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "./db";

export const createTRPCContext = async (opts: { req: NextRequest | { headers: Headers } }) => {
  return { db, req: opts.req };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
