/**
 * Starter lists.
 *
 * These are a first draft, never the list — the point is that the screen is not
 * empty at the moment you are trying to remember what you forget every time.
 * Everything is editable and deletable once it lands, and adding a template
 * twice adds nothing the second time.
 *
 * They stay short on purpose. A forty-item list is one nobody reads, and the
 * things worth prompting are the ones that ruin a trip when forgotten, not the
 * ones you would obviously pack anyway.
 */

export interface PackingTemplate {
  id: string;
  label: string;
  icon: 'briefcase-outline' | 'sunny-outline' | 'trail-sign-outline' | 'airplane-outline';
  description: string;
  items: { title: string; category: string | null }[];
}

const ESSENTIALS = 'Essentials';
const CLOTHES = 'Clothes';
const TECH = 'Tech';
const HEALTH = 'Health';

export const PACKING_TEMPLATES: PackingTemplate[] = [
  {
    id: 'basics',
    label: 'The basics',
    icon: 'briefcase-outline',
    description: 'What you need on any trip at all',
    items: [
      { title: 'ID or passport', category: ESSENTIALS },
      { title: 'Wallet and cards', category: ESSENTIALS },
      { title: 'Keys', category: ESSENTIALS },
      { title: 'Phone charger', category: TECH },
      { title: 'Power bank', category: TECH },
      { title: 'Headphones', category: TECH },
      { title: 'Toothbrush and toothpaste', category: HEALTH },
      { title: 'Any medication you take', category: HEALTH },
      { title: 'Underwear and socks', category: CLOTHES },
      { title: 'Something warm', category: CLOTHES },
    ],
  },
  {
    id: 'beach',
    label: 'Beach',
    icon: 'sunny-outline',
    description: 'Sun, sand and the things you burn without',
    items: [
      { title: 'Swimwear', category: CLOTHES },
      { title: 'Flip-flops', category: CLOTHES },
      { title: 'Sunglasses', category: CLOTHES },
      { title: 'Hat', category: CLOTHES },
      { title: 'Sunscreen', category: HEALTH },
      { title: 'After-sun', category: HEALTH },
      { title: 'Quick-dry towel', category: 'Beach' },
      { title: 'Dry bag for your phone', category: 'Beach' },
    ],
  },
  {
    id: 'trek',
    label: 'Trek',
    icon: 'trail-sign-outline',
    description: 'Cold, wet and a long way from a shop',
    items: [
      { title: 'Walking boots', category: CLOTHES },
      { title: 'Rain jacket', category: CLOTHES },
      { title: 'Warm layer', category: CLOTHES },
      { title: 'Water bottle', category: 'Gear' },
      { title: 'Head torch', category: 'Gear' },
      { title: 'Offline map downloaded', category: 'Gear' },
      { title: 'Blister plasters', category: HEALTH },
      { title: 'Snacks', category: 'Gear' },
    ],
  },
  {
    id: 'international',
    label: 'Going abroad',
    icon: 'airplane-outline',
    description: 'The paperwork that stops you at a desk',
    items: [
      { title: 'Passport — check the expiry', category: ESSENTIALS },
      { title: 'Visa or entry permit', category: ESSENTIALS },
      { title: 'Travel insurance details', category: ESSENTIALS },
      { title: 'Plug adapter', category: TECH },
      { title: 'Some local cash', category: ESSENTIALS },
      { title: 'Tell your bank you are travelling', category: ESSENTIALS },
      { title: 'Offline maps and translation downloaded', category: TECH },
      { title: 'Copies of your documents', category: ESSENTIALS },
    ],
  },
];
