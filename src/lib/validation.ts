import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const adjustSchema = z.object({
  mode: z.enum(["set", "delta"]),
  value: z.number().int().max(1_000_000),
  // Not restricted to the dropdown's fixed list — "Other" lets an account type
  // its own reason, which is sent here as free text instead of the literal "Other".
  reason: z.string().trim().min(1).max(200).optional(),
});

export const receiveSchema = z.object({
  quantity: z.number().int().positive().max(100_000),
  note: z.string().trim().max(200).optional(),
});

export const sendSchema = z.object({
  quantity: z.number().int().positive().max(100_000),
  shopId: z.string().min(1),
});

export const sendBatchSchema = z.object({
  shopId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100_000),
      })
    )
    .min(1)
    .max(200),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
});

export const createProductSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  stockCount: z.number().int().min(0).max(1_000_000).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const createShopSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const updateShopSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
  retired: z.boolean().optional(),
});

export const createAccountSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});
