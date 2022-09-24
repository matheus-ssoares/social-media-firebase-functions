import { z } from "zod";
import * as validaton from "@stone-ton/validaton";

const VALUES = ["Male", "Female"] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().superRefine((val, ctx) => {
    const validationResult = validaton.validateName(val);

    if (validationResult) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: String(validationResult),
      });
      return;
    }
  }),
  password: z.string().min(6),
});

const updateUserSchema = z.object({
  name: z.string().superRefine((val, ctx) => {
    const validationResult = validaton.validateName(val ?? "");

    if (validationResult) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: String(validationResult),
      });
      return;
    }
  }),
  zipcode: z
    .string()
    .superRefine((val, ctx) => {
      const validationResult = validaton.validateCep(val ?? "");

      if (validationResult) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: String(validationResult),
        });
        return;
      }
    })
    .optional(),
  birthdate: z
    .string()
    .superRefine((val, ctx) => {
      const validationResult = validaton.validateCep(val ?? "");

      if (validationResult) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: String(validationResult),
        });
        return;
      }
    })
    .optional(),
  phone: z
    .string()
    .superRefine((val, ctx) => {
      const validationResult = validaton.validatePhone(val ?? "");

      if (validationResult) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: String(validationResult),
        });
        return;
      }
    })
    .optional(),
  gender: z.enum(VALUES).optional(),
  image_url: z.string().optional(),
});

const getUserSchema = z.object({
  user_id: z.string(),
});
const searchUsersSchema = z.object({
  name: z.string(),
});
export { createUserSchema, getUserSchema, searchUsersSchema, updateUserSchema };
