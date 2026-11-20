export type Category = "food" | "groceries" | "shopping" | "gifts";
export type MarketplaceItem = {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  category: Category;
  priceCents: number;
  currency: "EUR";
  emoji: string;
  imageUrl?: string;
};
export type Merchant = {
  id: string;
  name: string;
  description: string;
  etaMinutes: [number, number];
  deliveryFeeCents: number;
  category: Category;
  emoji: string;
};
export type CartLine = { itemId: string; quantity: number };
export const categories: { id: Category; label: string; emoji: string }[] = [
  { id: "food", label: "Food", emoji: "🍔" },
  { id: "groceries", label: "Groceries", emoji: "🥑" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "gifts", label: "Gifts", emoji: "🎁" },
];
export const merchants: Merchant[] = [
  { id: "m1", name: "Pasta Piazza", description: "Handmade Italian favourites", etaMinutes: [20,35], deliveryFeeCents: 149, category: "food", emoji: "🍝" },
  { id: "m2", name: "Green Basket", description: "Fresh everyday essentials", etaMinutes: [25,40], deliveryFeeCents: 199, category: "groceries", emoji: "🥬" },
  { id: "m3", name: "City Finds", description: "Local lifestyle essentials", etaMinutes: [30,50], deliveryFeeCents: 249, category: "shopping", emoji: "🎒" },
  { id: "m4", name: "Little Joys", description: "Thoughtful gifts for anyone", etaMinutes: [25,45], deliveryFeeCents: 199, category: "gifts", emoji: "💐" },
];
export const items: MarketplaceItem[] = [
  { id: "p1", merchantId: "m1", title: "Margherita pizza", description: "Basil, mozzarella and tomato", category: "food", priceCents: 1090, currency: "EUR", emoji: "🍕" },
  { id: "p2", merchantId: "m1", title: "Pesto linguine", description: "Fresh basil and parmesan", category: "food", priceCents: 1290, currency: "EUR", emoji: "🍝" },
  { id: "p3", merchantId: "m2", title: "Farm avocados", description: "Pack of two ripe avocados", category: "groceries", priceCents: 420, currency: "EUR", emoji: "🥑" },
  { id: "p4", merchantId: "m2", title: "Strawberry punnet", description: "Fresh seasonal berries", category: "groceries", priceCents: 390, currency: "EUR", emoji: "🍓" },
  { id: "p5", merchantId: "m3", title: "Canvas tote", description: "Everyday reusable bag", category: "shopping", priceCents: 1800, currency: "EUR", emoji: "👜" },
  { id: "p6", merchantId: "m4", title: "Fresh flower bouquet", description: "A little joy, delivered", category: "gifts", priceCents: 2490, currency: "EUR", emoji: "💐" },
];
export const money = (cents: number, locale = "en-IE") => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
export function subtotal(lines: CartLine[]) { return lines.reduce((sum, line) => sum + (items.find(item => item.id === line.itemId)?.priceCents ?? 0) * line.quantity, 0); }
export function addItem(lines: CartLine[], itemId: string): CartLine[] {
  if (!items.some(item => item.id === itemId)) return lines;
  const found = lines.find(line => line.itemId === itemId);
  return found ? lines.map(line => line.itemId === itemId ? { ...line, quantity: line.quantity + 1 } : line) : [...lines, { itemId, quantity: 1 }];
}
export function removeItem(lines: CartLine[], itemId: string): CartLine[] {
  return lines.map(line => line.itemId === itemId ? { ...line, quantity: Math.max(0, line.quantity - 1) } : line).filter(line => line.quantity > 0);
}
