import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('src/generated',{recursive:true});
const skills=await Promise.all(['weekly-report','reply-style'].map(x=>readFile('skills/'+x+'.md','utf8')));
await writeFile('src/generated/skills.ts','export const skills = '+JSON.stringify(skills.join('\n\n'))+';\n');
