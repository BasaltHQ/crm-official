import { z } from "zod";

export const SendMailToAll = z.object({
  title: z
    .string({
      message: "Title is required and must be a string",
    })
    .min(3, {
      message: "Title must be at least 3 characters long",
    }),
  message: z
    .string({
      message: "Message is required and must be a string",
    })
    .min(3, {
      message: "Message must be at least 3 characters long",
    }),
});
