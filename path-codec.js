// Public, versioned curriculum codes. Personal messages exist only in full encrypted links.
export const characters=['ruth','joseph','mary','esther','abraham','thomas','hannah','peter','moses','david'];
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unb64=text=>{if(!/^[A-Za-z0-9_-]+$/.test(text))throw Error('The invitation link is incomplete.');return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));};
const bounded=(v,n,required=false)=>typeof v==='string'&&[...v].length<=n&&(!required||v.trim().length>0);
export function validate(i,catalog){
 const template=catalog.find(t=>t.id===i?.templateID);
 if(!i||i.version!==1||!template||!/^([0-9a-f]{8}-){1}[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i.id)||!Number.isFinite(Date.parse(i.createdAt))||!bounded(i.title,100,true)||!bounded(i.senderName,60)||!bounded(i.message,1000)||!characters.includes(i.characterID)||![2,5,10].includes(i.suggestedMinutes)||typeof i.recoveredFromCode!=='boolean'||!Array.isArray(i.stepIDs)||i.stepIDs.length<1||i.stepIDs.length>7||new Set(i.stepIDs).size!==i.stepIDs.length||i.stepIDs.some((id,j)=>!Number.isInteger(id)||!template.steps.some(s=>s.id===id)||(j>0&&id<=i.stepIDs[j-1])))throw Error('This path invitation is incomplete. Ask for the full link or check your PATH code.');
 return i;
}
export async function decode(fragment,catalog){
 if(!fragment.startsWith('#p1=')||fragment.length>12001)throw Error('Open the complete invitation link, or use its PATH code.');
 const parts=fragment.slice(4).split('.');if(parts.length!==2)throw Error('The invitation link is incomplete.');
 const box=unb64(parts[0]),raw=unb64(parts[1]);if(raw.length!==32||box.length<28||box.length>8028)throw Error('The invitation link is incomplete.');
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:box.slice(0,12),tagLength:128},key,box.slice(12));
 if(data.byteLength>8000)throw Error('The invitation is too large.');
 return validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)),catalog);
}
export async function encode(i,catalog){
 validate(i,catalog);const data=new TextEncoder().encode(JSON.stringify(i));if(data.length>8000)throw Error('The invitation is too large.');
 const raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,data));
 return '#p1='+b64(new Uint8Array([...iv,...cipher]))+'.'+b64(raw);
}
export async function recoveryCode(i,catalog){
 validate(i,catalog);const index=catalog.findIndex(t=>t.id===i.templateID),mask=i.stepIDs.reduce((n,id)=>n|(1<<id),0);
 const payload=new Uint8Array([1,index,mask,[2,5,10].indexOf(i.suggestedMinutes)*16+characters.indexOf(i.characterID)]);
 const sum=new Uint8Array(await crypto.subtle.digest('SHA-256',payload));
 const bits=[...payload,...sum.slice(0,3)].map(b=>b.toString(2).padStart(8,'0')).join('')+'0000';
 let result='';for(let p=0;p<bits.length;p+=5)result+=alphabet[parseInt(bits.slice(p,p+5),2)];
 return 'PATH-'+result.match(/.{1,4}/g).join('-');
}
export async function fromCode(input,catalog){
 const normalized=input.toUpperCase().replace(/[\s-]/g,'');
 if(!normalized.startsWith('PATH')||normalized.length!==16)throw Error('Check the complete PATH code.');
 let bits='';for(const c of normalized.slice(4)){const index=alphabet.indexOf(c);if(index<0)throw Error('Check the PATH code.');bits+=index.toString(2).padStart(5,'0');}
 if(bits.slice(56)!=='0000')throw Error('Check the PATH code.');
 const bytes=Uint8Array.from(bits.slice(0,56).match(/.{8}/g),b=>parseInt(b,2));
 const sum=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice(0,4)));
 if(sum.slice(0,3).some((b,index)=>b!==bytes[index+4])||bytes[0]!==1||!catalog[bytes[1]]||bytes[2]===0||bytes[2]>127||Math.floor(bytes[3]/16)>2||!characters[bytes[3]%16])throw Error('This code could not be checked. Ask for the original invitation link.');
 const t=catalog[bytes[1]],i={version:1,id:crypto.randomUUID(),createdAt:new Date().toISOString(),templateID:t.id,stepIDs:t.steps.filter(s=>bytes[2]&(1<<s.id)).map(s=>s.id),title:t.title,senderName:'',message:'',characterID:characters[bytes[3]%16],suggestedMinutes:[2,5,10][Math.floor(bytes[3]/16)],recoveredFromCode:true};
 return validate(i,catalog);
}
