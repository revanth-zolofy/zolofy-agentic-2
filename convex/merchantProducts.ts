import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('merchantProducts').collect();
  },
});

export const getById = query({
  args: { id: v.id('merchantProducts') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    storeName: v.string(),
    storeLocation: v.string(),
    productName: v.string(),
    productCategory: v.string(),
    unit: v.string(),
    baseRate: v.number(),
    currency: v.string(),
    formula: v.string(),
    variables: v.array(
      v.object({
        name: v.string(),
        role: v.string(),
        min: v.number(),
        max: v.number(),
        hint: v.string(),
      })
    ),
    constants: v.any(),
    imageUrl: v.string(),
    developerNote: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('merchantProducts', args);
  },
});

export const update = mutation({
  args: {
    id: v.id('merchantProducts'),
    storeName: v.string(),
    storeLocation: v.string(),
    productName: v.string(),
    productCategory: v.string(),
    unit: v.string(),
    baseRate: v.number(),
    currency: v.string(),
    formula: v.string(),
    variables: v.array(
      v.object({
        name: v.string(),
        role: v.string(),
        min: v.number(),
        max: v.number(),
        hint: v.string(),
      })
    ),
    constants: v.any(),
    imageUrl: v.string(),
    developerNote: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});
