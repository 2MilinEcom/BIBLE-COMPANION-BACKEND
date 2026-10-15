import {decode,encode,characters,validate} from './codec.js';
const $=id=>document.getElementById(id);
history.scrollRestoration='manual';
const names={ruth:'Ruth',joseph:'Joseph',mary:'Mary of Bethany',esther:'Esther',abraham:'Abraham',thomas:'Thomas',hannah:'Hannah',peter:'Peter',moses:'Moses',david:'David'};
const STORAGE='bibleCompanion.ourMoments.v1';
let envelope, replyURL, sharedReply, appLink, savedCorrupt=false;
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
const giftCopy={
  heart:{title:['A little love.','Wrapped just for you.'],caption:'One small gift. A little room to feel it.'},
  letter:{title:['Some words deserve','their own envelope.'],caption:'A little letter, with a lot of thought behind it.'},
  sunshine:{title:['A little sunshine.','Just for your day.'],caption:'Someone wanted to send a little light your way.'},
  prayer:{title:['A quiet moment.','Held with care.'],caption:'A little space to pause, breathe, and feel remembered.'},
  surprise:{title:['No occasion.','Just because it’s you.'],caption:'The best little things don’t always need a reason.'}
};
let opening=false, opened=false, revealTimer;
function showGift(invitation){
  const style=invitation.giftStyle||'heart', copy=giftCopy[style];
  document.body.dataset.gift=style;
  const heading=$('gift-title');heading.replaceChildren(document.createTextNode(copy.title[0]),document.createElement('br'),document.createTextNode(copy.title[1]));
  text('gift-from',invitation.senderName?'From '+invitation.senderName+', with care.':'A little something from someone who cares.');
  text('gift-caption',copy.caption);
  $('gift-stage').hidden=false;$('our-local').hidden=true;
  window.scrollTo({top:0,behavior:'instant'});
}
function revealGift(immediate=false){
  if(opened || opening)return;
  opening=true;const animate=!immediate && !motion.matches;
  $('unwrap').disabled=true;$('skip-opening').disabled=true;
  text('gift-opening-status','Opening your little gift…');
  const finish=()=>{
    if(opened)return;opened=true;opening=false;clearTimeout(revealTimer);
    $('gift-stage').hidden=true;$('content').hidden=false;$('our-local').hidden=false;
    document.body.classList.add('gift-opened');
    if(!animate)document.body.classList.add('still-reveal');
    $('note').focus({preventScroll:true});
    $('content').scrollIntoView({behavior:'instant',block:'start'});
  };
  if(animate){$('gift-stage').classList.add('unwrapping');revealTimer=setTimeout(finish,1150);}else finish();
}
$('unwrap').addEventListener('click',()=>revealGift());
$('skip-opening').addEventListener('click',()=>revealGift(true));
const text=(id,value)=>$(id).textContent=value;
const reference=i=>i.verses[0].book+' '+i.verses[0].chapter+':'+i.verses.map(v=>v.verse).join(',');
function openApp(url) {
  appLink=url;
  const direct='biblecompanion://together#'+url.split('#')[1];
  $('open-app').href=direct.length<=1800?direct:'biblecompanion://together-import';
  $('open-app').textContent=direct.length<=1800?'Open in Bible Companion':'Copy link & open in Bible Companion';
}
$('open-app').addEventListener('click',async event=>{
  if(!appLink || $('open-app').getAttribute('href')!=='biblecompanion://together-import')return;
  event.preventDefault();
  try{await navigator.clipboard.writeText(appLink);location.href='biblecompanion://together-import';}
  catch{ $('manual-copy').hidden=false;$('reply-url').value=appLink;$('reply-url').select();text('status','Copy the complete link below, then paste it in the app under Our moments.');$('status').hidden=false; }
});
function readSaved(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(value))throw Error();for(const e of value){validate(e);if(!e.reply?.allowsKeeping || !e.invitation.allowsKeeping)throw Error();}return value;}catch{savedCorrupt=true;return[];}}
function renderSaved(){
  const holder=$('local-moments');holder.replaceChildren();
  const items=readSaved();
  if(!items.length){const p=document.createElement('p');p.className='quiet';p.textContent=savedCorrupt?'Your saved moments could not be opened. They are preserved, and new saves are paused.':'Shared moments you both choose to keep will appear here.';holder.append(p);return;}
  for(const e of items){
    const article=document.createElement('article'), title=document.createElement('h3'), p=document.createElement('p'), a=document.createElement('a');
    title.textContent=reference(e.invitation);p.textContent=e.invitation.question;a.textContent='Revisit these perspectives';a.className='button';
    a.href='#';a.addEventListener('click',async event=>{event.preventDefault();const url=await encode(e,location.origin);location.assign(url);location.rewindow.addEventListener('hashchange',()=>location.reload());
load();});
    const remove=document.createElement('button');remove.textContent='Remove my copy';remove.addEventListener('click',()=>{if(window.confirm('Remove this copy from this browser? Copies already shared are unaffected.')){localStorage.setItem(STORAGE,JSON.stringify(readSaved().filter(x=>x.reply?.id!==e.reply?.id)));renderSaved();}});
    article.append(title,p,a,remove);holder.append(article);
  }
}
function allowSave(e){
  sharedReply=e;
  $('save').disabled=readSaved().some(x=>x.reply.id===e.reply?.id);text('saved','');
  $('save-card').hidden=!(e.reply && e.invitation.allowsKeeping && e.reply.allowsKeeping);
}
async function load(){
  renderSaved();
  if(!location.hash){text('status','Open an invitation link someone shared with you. You can read and reply here without the app.');return;}
  try{
    envelope=await decode(location.hash);
    const i=envelope.invitation;
    $('status').hidden=true;
    if(envelope.reply){document.body.dataset.gift=i.giftStyle||'heart';$('content').hidden=false;text('reveal-caption','Two perspectives. One passage. Room for both.');}
    else showGift(i);
    text('from',i.senderName?'AN INVITATION FROM '+i.senderName:'A MOMENT SOMEONE WANTED TO SHARE');
    text('note',i.note||'I wanted to read this with you.');text('reference',reference(i));
    for(const v of i.verses){const p=document.createElement('p'),number=document.createElement('span');number.className='verse';number.textContent=v.verse;p.append(number,document.createTextNode(v.text));$('verses').append(p);}
    text('takeaway-title',i.takeawayTitle);text('takeaway',i.takeaway);$('takeaway-card').hidden=!i.takeaway;
    text('question',i.question);$('guide-art').src='/together/assets/'+i.characterID+'.png';$('guide-art').alt='Illustration of '+names[i.characterID];
    if(i.perspective){$('sender-perspective').hidden=false;text('sender-title',(i.senderName||'Their')+' shared perspective');text('sender-words',i.perspective);}
    for(const character of characters){const o=document.createElement('option');o.value=character;o.textContent=names[character];$('character').append(o);} $('character').value='ruth';
    text('consent-note',i.allowsKeeping?'Your partner has opted into keeping this exchange if you agree too.':'Your partner has not opted into keeping a shared copy. You can still share your perspective.');
    openApp(location.href);
    if(envelope.reply){const r=envelope.reply;$('reply-form').hidden=true;$('received-perspective').hidden=false;text('reader-title',(r.readerName||'The other reader')+"'s perspective");text('reader-words',r.perspective);allowSave(envelope);text('guide-words','Two perspectives can sit side by side. What connects, and what do you see differently?');}
  }catch{ text('status','This invitation is incomplete or could not be opened. Ask your partner for a fresh link.'); }
}
$('preview').addEventListener('click',async()=>{
  const perspective=$('perspective').value.trim();if(!perspective){$('perspective').focus();return;}
  try{
    const reply={id:crypto.randomUUID(),createdAt:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),invitation:envelope.invitation,readerName:$('name').value.trim(),perspective,characterID:$('character').value,allowsKeeping:$('keep').checked};
    const e={version:1,invitation:envelope.invitation,reply};replyURL=await encode(e,location.origin);
    text('reply-words',perspective);text('reply-consent',reply.allowsKeeping?'You chose to allow keeping these shared words.':'You have not agreed to keeping a shared copy.');$('reply-form').hidden=true;$('reply-preview').hidden=false;allowSave(e);openApp(replyURL);$('reply-preview').scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});
  }catch(error){text('status',error.message);$('status').hidden=false;}
});
$('edit').addEventListener('click',()=>{$('reply-form').hidden=false;$('reply-preview').hidden=true;$('save-card').hidden=true;sharedReply=undefined;replyURL=undefined;openApp(location.href);});
$('share').addEventListener('click',async()=>{if(!replyURL)return;try{if(navigator.share){await navigator.share({title:'Our perspectives · Bible Companion',text:'I wanted to share what stood out to me.',url:replyURL});}else await copyReply();}catch(error){if(error.name!=='AbortError')await copyReply();}});
async function copyReply(){if(!replyURL)return;try{await navigator.clipboard.writeText(replyURL);$('copy').textContent='Reply link copied';}catch{$('manual-copy').hidden=false;$('reply-url').value=replyURL;$('reply-url').select();}}
$('copy').addEventListener('click',copyReply);
$('save').addEventListener('click',()=>{
  if(savedCorrupt){text('saved','Existing saved data could not be opened and has not been replaced. You can save this moment in the app instead.');return;}
  if(!(sharedReply?.invitation.allowsKeeping && sharedReply?.reply?.allowsKeeping))return;
  try{const values=readSaved();if(!values.some(x=>x.reply.id===sharedReply.reply.id))values.unshift(sharedReply);localStorage.setItem(STORAGE,JSON.stringify(values));text('saved','Kept on this browser. Your partner chooses whether to keep their own copy.');$('save').disabled=true;renderSaved();}catch{text('saved','This browser could not save the moment. You can open it in the app instead.');}
});
window.addEventListener('hashchange',()=>location.reload());
load();
