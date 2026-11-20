import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const core=await import(path.join(root,'packages/core/src/index.ts'));
const brand=await import(path.join(root,'packages/brand/src/index.ts'));
const manifest=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'packages/test-kit/package.json'),'utf8'));
const data={
 schemaVersion:1,
 artifactVersion:manifest.version,
 synthetic:true,
 disclaimer:'Demo data only. Prices and merchants are fictional. No checkout or live courier tracking.',
 brand:{name:brand.brandName,preferredPalette:brand.preferredPalette,mascot:brand.mascot,palettes:brand.palettes},
 categories:core.categories,
 products:core.products
};
const out=path.join(root,'packages/test-kit/dist');
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'marketplace.json'),JSON.stringify(data,null,2)+'\n');
await writeFile(path.join(out,'index.mjs'),'/** Generated synthetic Tazumo test fixtures. */\nexport const fixture = '+JSON.stringify(data,null,2)+';\nexport default fixture;\n');
console.log('Generated test package',manifest.name,manifest.version,'with',data.products.length,'synthetic products');
