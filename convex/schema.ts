import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  merchantProducts: defineTable({
    storeName: v.string(),
    storeLocation: v.string(),
    productName: v.string(),
    productCategory: v.string(),
    unit: v.string(),
    baseRate: v.number(),
    currency: v.string(),
    formula: v.string(),
    variables: v.array(v.object({
      name: v.string(),
      role: v.string(),
      min: v.number(),
      max: v.number(),
      hint: v.string(),
    })),
    constants: v.any(),
    imageUrl: v.string(),
    developerNote: v.string(),
  }),

  ephemeral_skus: defineTable({
    productId: v.id('merchantProducts'),
    variables: v.any(),
    price: v.number(),
    status: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }),
});
