import { mutation } from './_generated/server';

export const seedInitialCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('merchantProducts').first();
    if (existing) return { seeded: false, reason: 'catalog already has products' };

    const products = [
      {
        storeName: 'Grand Hyatt',
        storeLocation: 'Dubai, UAE',
        productName: 'Luxury Suite',
        productCategory: 'Hotels',
        unit: 'per night',
        baseRate: 450,
        currency: 'USD',
        formula: 'baseRate * nights * rooms + breakfast_rate * guests * nights',
        variables: [
          { name: 'nights',  label: 'Nights',        role: 'time',     min: 1,  max: 30, hint: 'How many nights?' },
          { name: 'rooms',   label: 'Rooms',          role: 'quantity', min: 1,  max: 5,  hint: 'How many rooms?' },
          { name: 'guests',  label: 'Guests',         role: 'quantity', min: 1,  max: 10, hint: 'How many guests?' },
        ],
        constants: { breakfast_rate: 45 },
        imageUrl: '',
        developerNote: '',
      },
      {
        storeName: 'Nikki Beach',
        storeLocation: 'Dubai, UAE',
        productName: 'Beach Club Day Pass',
        productCategory: 'Beach Resort',
        unit: 'per day',
        baseRate: 150,
        currency: 'USD',
        formula: 'baseRate * guests + cabana_rate * cabanas',
        variables: [
          { name: 'guests',  label: 'Guests',          role: 'quantity', min: 1, max: 20, hint: 'How many guests?' },
          { name: 'cabanas', label: 'Private cabanas', role: 'quantity', min: 0, max: 5,  hint: 'How many private cabanas? (0 for none)' },
        ],
        constants: { cabana_rate: 200 },
        imageUrl: '',
        developerNote: '',
      },
      {
        storeName: 'MSC Cruises',
        storeLocation: 'Barcelona, Spain',
        productName: 'Mediterranean Cruise Package',
        productCategory: 'Cruise',
        unit: 'per package',
        baseRate: 899,
        currency: 'USD',
        formula: 'baseRate * guests * nights + suite_upgrade * has_suite',
        variables: [
          { name: 'guests',    label: 'Guests',        role: 'quantity', min: 1, max: 6,  hint: 'How many guests?' },
          { name: 'nights',    label: 'Nights',        role: 'time',     min: 3, max: 14, hint: 'How many nights?' },
          { name: 'has_suite', label: 'Suite upgrade', role: 'quantity', min: 0, max: 1,  hint: 'Suite upgrade? 1=Yes 0=No' },
        ],
        constants: { suite_upgrade: 800 },
        imageUrl: '',
        developerNote: '',
      },
      {
        storeName: 'EventForge',
        storeLocation: 'Bangalore, India',
        productName: 'Corporate Event Package',
        productCategory: 'Events',
        unit: 'per event',
        baseRate: 45,
        currency: 'USD',
        formula: 'baseRate * attendees * duration_hours + av_package + catering_per_head * attendees',
        variables: [
          { name: 'attendees',       label: 'Attendees',     role: 'quantity', min: 10, max: 500, hint: 'How many attendees?' },
          { name: 'duration_hours',  label: 'Duration (hrs)',role: 'time',     min: 2,  max: 12,  hint: 'How many hours?' },
        ],
        constants: { av_package: 800, catering_per_head: 35 },
        imageUrl: '',
        developerNote: '',
      },
      {
        storeName: 'Zolofy Business',
        storeLocation: 'Global',
        productName: 'Business Travel Package',
        productCategory: 'Business',
        unit: 'per trip',
        baseRate: 1200,
        currency: 'USD',
        formula: 'baseRate * travelers + hotel_nights * hotel_rate * travelers + airport_transfers * transfer_rate',
        variables: [
          { name: 'travelers',          label: 'Travelers',         role: 'quantity', min: 1, max: 10, hint: 'How many travelers?' },
          { name: 'hotel_nights',       label: 'Hotel nights',      role: 'time',     min: 0, max: 14, hint: 'How many hotel nights needed?' },
          { name: 'airport_transfers',  label: 'Airport transfers', role: 'quantity', min: 0, max: 10, hint: 'How many airport transfers?' },
        ],
        constants: { hotel_rate: 180, transfer_rate: 45 },
        imageUrl: '',
        developerNote: '',
      },
    ];

    for (const p of products) {
      await ctx.db.insert('merchantProducts', p);
    }

    return { seeded: true, count: products.length };
  },
});
