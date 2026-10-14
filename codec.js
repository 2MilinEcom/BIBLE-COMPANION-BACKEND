// AES-GCM wire format shared with CryptoKit: nonce (12 bytes), ciphertext, tag (16 bytes).
const characters = ['ruth','joseph','mary','esther','abraham','thomas','hannah','peter','moses','david'];
const bounded = (v,n,required=false) => typeof v==='string' && [...v].length<=n && (!required || v.trim().length>0);
const validDate = v => typeof v==='string' && Number.isFinite(Date.parse(v));
export function validate(e) {
  const i=e?.invitation;
  if (e?.version!==1 || !i || !/^[0-9a-f-]{36}$/i.test(i.id) || !validDate(i.createdAt) || typeof i.allowsKeeping!=='boolean' || !characters.includes(i.characterID) || !bounded(i.senderName,60) || !bounded(i.note,1000) || !bounded(i.takeawayTitle,180,true) || !bounded(i.takeaway,1800) || !bounded(i.question,500,true) || !bounded(i.perspective,1500) || !Array.isArray(i.verses) || i.verses.length<1 || i.verses.length>10) throw Error('This invitation is incomplete. Ask for a fresh link.');
  const first=i.verses[0], seen=new Set();
  for(const v of i.verses) {
    if (!bounded(v.book,40,true) || v.book!==first.book || v.chapter!==first.chapter || !Number.isInteger(v.chapter) || v.chapter<1 || !Number.isInteger(v.verse) || v.verse<1 || seen.has(v.verse) || !bounded(v.text,1800,true)) throw Error('This shared passage could not be opened.');
    seen.add(v.verse);
  }
  if(e.reply) {
    const r=e.reply;
    // Re-serialization must preserve the complete invitation, including all verses.
    if (!/^[0-9a-f-]{36}$/i.test(r.id) || !validDate(r.createdAt) || !bounded(r.readerName,60) || !bounded(r.perspective,1500,true) || typeof r.allowsKeeping!=='boolean' || !characters.includes(r.characterID) || JSON.stringify(r.invitation)!==JSON.stringify(i)) throw Error('This reply does not match its invitation.');
  }
  return e;
}
const b64 = bytes => {
  let text=''; for(const b of bytes) text+=String.fromCharCode(b);
  return btoa(text).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
};
const unb64 = text => {
  if(!/^[A-Za-z0-9_-]+$/.test(text)) throw Error('Incomplete link.');
  return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
};
export async function decode(fragment) {
  if(!fragment.startsWith('#v1=') || fragment.length>36001) throw Error('Open the complete invitation link your partner shared.');
  const parts=fragment.slice(4).split('.'); if(parts.length!==2) throw Error('Incomplete link.');
  const box=unb64(parts[0]), raw=unb64(parts[1]);
  if(raw.length!==32 || box.length<28 || box.length>24028) throw Error('This invitation is too large or incomplete.');
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:box.slice(0,12),tagLength:128},key,box.slice(12));
  if(data.byteLength>24000) throw Error('This invitation is too large.');
  return validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)));
}
export async function encode(e, origin) {
  validate(e);
  const data=new TextEncoder().encode(JSON.stringify(e)); if(data.length>24000) throw Error('Please shorten your response.');
  const raw=crypto.getRandomValues(new Uint8Array(32)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,data));
  const box=new Uint8Array(iv.length+encrypted.length);box.set(iv);box.set(encrypted,iv.length);
  return origin+'/together#v1='+b64(box)+'.'+b64(raw);
}
export { characters };
