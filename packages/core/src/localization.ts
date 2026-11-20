export const languages=['en','cs','de'] as const;
export type Language=typeof languages[number];
const dictionary={
 en:{city:'Discover your city',cart:'Cart',eyebrow:'LOCAL GOODNESS, ON YOUR TERMS',heroStart:'Good things are',heroEnd:'closer.',intro:'Food, groceries and local favourites, all in one place.',search:'What are you looking for?',demo:'Preview catalogue. Prices and availability are illustrative.',explore:'Explore your neighbourhood',section:'What are you craving?',everything:'Everything',basket:'Your basket',subtotal:'Subtotal',empty:'No matching products.',disabled:'Checkout is disabled until payment and delivery integrations are ready.',add:'Add',color:'Colors',language:'Language',closeCart:'Close cart',emptyBasket:'Your basket is empty. Let’s find something good.',removeOne:'Remove one',addOne:'Add one',checkoutLater:'Checkout coming later'},
 cs:{city:'Objevte své město',cart:'Košík',eyebrow:'TO NEJLEPŠÍ Z VAŠEHO OKOLÍ',heroStart:'Vše dobré máte',heroEnd:'blíž.',intro:'Jídlo, potraviny i místní obchody na jednom místě.',search:'Co hledáte?',demo:'Ukázkový katalog. Ceny a dostupnost jsou ilustrativní.',explore:'Prozkoumejte své okolí',section:'Na co máte chuť?',everything:'Vše',basket:'Váš košík',subtotal:'Mezisoučet',empty:'Žádné odpovídající produkty.',disabled:'Platby a doručování zatím nejsou k dispozici.',add:'Přidat',color:'Barvy',language:'Jazyk',closeCart:'Zavřít košík',emptyBasket:'Váš košík je prázdný.',removeOne:'Odebrat jeden kus',addOne:'Přidat jeden kus',checkoutLater:'Pokladna bude dostupná později'},
 de:{city:'Entdecke deine Stadt',cart:'Warenkorb',eyebrow:'DAS BESTE AUS DEINER NACHBARSCHAFT',heroStart:'Gutes ist jetzt',heroEnd:'näher.',intro:'Essen, Lebensmittel und lokale Geschäfte an einem Ort.',search:'Wonach suchst du?',demo:'Demo-Katalog. Preise und Verfügbarkeit sind Beispiele.',explore:'Entdecke deine Umgebung',section:'Worauf hast du Lust?',everything:'Alles',basket:'Dein Warenkorb',subtotal:'Zwischensumme',empty:'Keine passenden Produkte gefunden.',disabled:'Bestellung und Bezahlung sind noch nicht verfügbar.',add:'Hinzufügen',color:'Farben',language:'Sprache',closeCart:'Warenkorb schließen',emptyBasket:'Dein Warenkorb ist leer.',removeOne:'Einmal entfernen',addOne:'Einmal hinzufügen',checkoutLater:'Zur Kasse bald verfügbar'}
} as const;
export type MessageKey=keyof typeof dictionary.en;
export const t=(lang:Language,key:MessageKey):string=>dictionary[lang][key];
const categoryLabels={
 en:{Food:'Food',Groceries:'Groceries',Shops:'Shops',Gifts:'Gifts'},
 cs:{Food:'Jídlo',Groceries:'Potraviny',Shops:'Obchody',Gifts:'Dárky'},
 de:{Food:'Essen',Groceries:'Lebensmittel',Shops:'Geschäfte',Gifts:'Geschenke'}
} as const;
export const categoryLabel=(lang:Language,category:keyof typeof categoryLabels.en):string=>categoryLabels[lang][category];
export const languageLocale:Record<Language,string>={en:'en-IE',cs:'cs-CZ',de:'de-DE'};
export const formatLocalizedPrice=(cents:number,lang:Language,currency='EUR')=>new Intl.NumberFormat(languageLocale[lang],{style:'currency',currency}).format(cents/100);
