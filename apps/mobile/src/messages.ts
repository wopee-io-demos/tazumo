import type {Language} from '@tazumo/core';

const messages={
 en:{back:'Back',viewCart:'View cart',openDetails:'Opens product details',addToCart:'Add to cart',inCart:'In your cart',remove:'Remove',quantity:'Quantity',prototype:'Prototype only: checkout is disabled. No order is placed and no payment is taken.'},
 cs:{back:'Zpět',viewCart:'Zobrazit košík',openDetails:'Otevře detail produktu',addToCart:'Přidat do košíku',inCart:'V košíku',remove:'Odstranit',quantity:'Množství',prototype:'Pouze prototyp: pokladna je vypnutá. Žádná objednávka ani platba neproběhne.'},
 de:{back:'Zurück',viewCart:'Warenkorb ansehen',openDetails:'Öffnet die Produktdetails',addToCart:'In den Warenkorb',inCart:'Im Warenkorb',remove:'Entfernen',quantity:'Menge',prototype:'Nur Prototyp: Die Kasse ist deaktiviert. Es wird keine Bestellung aufgegeben und nichts bezahlt.'}
} as const satisfies Record<Language,Record<string,string>>;

export type MobileMessageKey=keyof typeof messages.en;
export const languagesWithMessages=Object.keys(messages) as Language[];
export const m=(lang:Language,key:MobileMessageKey):string=>messages[lang][key];
