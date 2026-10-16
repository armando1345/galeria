// Export only files admitted by Git; local secrets, dependencies and state stay out.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,copyFile,mkdir,access,stat} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=resolve(root,'../PARA-SUBIR-A-GITHUB');
try{await access(destination);throw Error('La carpeta PARA-SUBIR-A-GITHUB ya existe. Consérvala o renómbrala antes de preparar otra copia.');}catch(error){if(error.code!=='ENOENT')throw error;}
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))].sort();
if(files.length>100)throw Error(`Hay ${files.length} archivos; el límite para una subida web es 100.`);
const forbidden=/(^|\/)(node_modules|\.pnpm-store|\.git|\.wrangler|dist|private|output)(\/|$)|(^|\/)\.dev\.vars(?:\.|$)|(^|\/)\.env(?:\.|$)/;
const secrets=[];
for(const file of ['private/organizador.txt','private/accesos-estudiantes.csv','.dev.vars']){
 const contents=await readFile(resolve(root,file),'utf8').catch(()=>null);if(!contents)continue;
 if(file.endsWith('.csv'))secrets.push(...contents.trim().split('\n').slice(1).map(line=>line.trim().split(',')[1]));
 else if(file.endsWith('.txt'))secrets.push(contents.trim().split('\n').at(-1).trim());
 else secrets.push(...[...contents.matchAll(/=["']?([a-f0-9]{64})/gi)].map(match=>match[1]));
}
const manifest=[];
for(const file of files){
 if(forbidden.test(file))throw Error(`Un archivo privado o local fue incluido por Git: ${file}`);
 const path=resolve(root,file),within=relative(root,path);if(within.startsWith('..')||isAbsolute(within))throw Error('Ruta fuera del proyecto.');
 const metadata=await stat(path);if(!metadata.isFile()||metadata.size>25*1024*1024)throw Error(`Archivo incompatible con la subida web: ${file}`);
 const bytes=await readFile(path),text=bytes.toString('utf8');
 if(secrets.filter(Boolean).some(secret=>text.includes(secret)))throw Error(`Se detectó un acceso privado en ${file}. No se generó la copia.`);
 if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text))throw Error(`Revisa una posible credencial en ${file}.`);
 manifest.push({file,bytes:metadata.size,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const item of manifest){const target=resolve(destination,item.file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,item.file),target);const copied=await readFile(target);if(createHash('sha256').update(copied).digest('hex')!==item.sha256)throw Error(`Error al copiar ${item.file}`);}
const totalBytes=manifest.reduce((sum,item)=>sum+item.bytes,0);
await mkdir(resolve(root,'output'),{recursive:true});
await writeFile(resolve(root,'output/github-export.json'),JSON.stringify({createdAt:new Date().toISOString(),destination,fileCount:files.length,totalBytes,secretsExcluded:true,verifiedHashes:true,files:manifest},null,2));
console.log(JSON.stringify({folder:destination,files:files.length,megabytes:Number((totalBytes/1024/1024).toFixed(2)),allHashesVerified:true,privateFilesExcluded:true},null,2));
