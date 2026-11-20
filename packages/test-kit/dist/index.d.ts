export type Palette = {readonly primary:string;readonly accent:string;readonly background:string;readonly ink:string};
export type FixtureProduct = {readonly id:string;readonly merchant:string;readonly name:string;readonly category:'Food'|'Groceries'|'Shops'|'Gifts';readonly description:string;readonly priceCents:number;readonly emoji:string};
export type TestFixtures = {
 readonly schemaVersion:number;readonly artifactVersion:string;readonly synthetic:true;readonly disclaimer:string;
 readonly brand:{readonly name:string;readonly preferredPalette:string;readonly mascot:string;readonly palettes:Readonly<Record<string,Palette>>};
 readonly categories:readonly string[];readonly products:readonly FixtureProduct[];
};
export declare const fixture:TestFixtures;
export default fixture;
