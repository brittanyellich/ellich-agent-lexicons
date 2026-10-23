import {readFile,readdir} from 'node:fs/promises';
import {Lexicons} from '@atproto/lexicon';
export const directory = new URL('../lexicons/at/ellich/agent/',import.meta.url);
export async function load() {
 const schemas=await Promise.all((await readdir(directory)).filter(x=>x.endsWith('.json')).map(async x=>JSON.parse(await readFile(new URL(x,directory),'utf8'))));
 const records=schemas.filter(x=>x.defs.main.type==='record');
 const validator=new Lexicons(records);
 return {schemas,validator};
}
if (process.argv[1] && import.meta.url===new URL(process.argv[1],'file:').href) {
 const {schemas}=await load(); console.log(`Validated ${schemas.filter(x=>x.defs.main.type==='record').length} record schemas with @atproto/lexicon. Space alpha declaration is not covered by this stable validator.`);
}
