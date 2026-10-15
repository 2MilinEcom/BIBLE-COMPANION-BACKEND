import {decode,encode,characters,validate} from './codec.js';
import {startConversation,forgetCachedConversation,stopCurrentConversation} from './conversation.js';
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
    startLiveConversation();
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
  if(!appLink||$('open-app').getAttribute('href')!=='biblecompanion://together-import')return;
  event.preventDefault();
  try{await navigator.clipboard.writeText(appLink);location.href='biblecompanion://together-import';}
  catch{showManual(appLink);text('status','Copy the complete link below, then paste it in the app under Our moments.');$('status').hidden=false;}
});
function readSaved(){
  try{const value=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(value))throw Error();for(const e of value)validate(e);return value;}
  catch{savedCorrupt=true;return[];}
}
function remember(e){
  const values=readSaved();
  if(savedCorrupt){text('automatic-save-status','Existing saved moments couldn’t be opened. They have been preserved; new local saves are paused.');return;}
  const index=values.findIndex(x=>x.invitation.id.toLowerCase()===e.invitation.id.toLowerCase());
  if(index>=0){if(values[index].reply&&!e.reply)return;values[index]=e;}else values.unshift(e);
  try{localStorage.setItem(STORAGE,JSON.stringify(values));text('automatic-save-status','Saved in Our moments on this browser automatically. You can remove your copy later.');renderSaved();}
  catch{text('automatic-save-status','This browser couldn’t save your gift. You can return with its link or save it in the app.');}
}
function renderSaved(){
  const holder=$('local-moments');holder.replaceChildren();const items=readSaved();
  if(!items.length){const p=document.createElement('p');p.className='quiet';p.textContent=savedCorrupt?'Your saved moments could not be opened. They are preserved, and new saves are paused.':'Your gifts and conversations will appear here automatically.';holder.append(p);return;}
  for(const e of items){
    const article=document.createElement('article'),title=document.createElement('h3'),p=document.createElement('p'),a=document.createElement('a');
    title.textContent=reference(e.invitation);p.textContent=e.invitation.note||e.invitation.question;
    a.textContent=e.invitation.conversation?'Open our conversation':'Open this shared moment';a.className='button';a.href='#';
    a.addEventListener('click',async event=>{event.preventDefault();const url=await encode(e,location.origin);if(url===location.href)location.reload();else location.assign(url);});
    const remove=document.createElement('button');remove.textContent='Remove my copy';
    remove.addEventListener('click',()=>{
      if(window.confirm('Remove this copy from this browser? Your partner’s copy and any shared conversation remain. Opening the gift link again will save it here again.')){
        try{localStorage.setItem(STORAGE,JSON.stringify(readSaved().filter(x=>x.invitation.id!==e.invitation.id)));if(e.invitation.conversation)forgetCachedConversation(e.invitation.conversation.id);if(envelope?.invitation.id===e.invitation.id){stopCurrentConversation();$('content').hidden=true;$('gift-stage').hidden=true;text('status','Your saved copy was removed. Opening the gift link again brings it back.');$('status').hidden=false;}renderSaved();}
        catch{text('automatic-save-status','This browser could not remove the saved copy.');}
      }
    });
    article.append(title,p,a,remove);holder.append(article);
  }
}
let conversationStarted=false;
function startLiveConversation(){
  if(!envelope?.invitation.conversation||conversationStarted)return;
  conversationStarted=true;startConversation(envelope.invitation).catch(()=>{text('status','The conversation couldn’t open. Your gift is still here.');$('status').hidden=false;});
}
async function load(){
  renderSaved();
  if(!location.hash){text('status','Open an invitation link someone shared with you. You can read and reply here without the app.');return;}
  try{
    envelope=await decode(location.hash);const i=envelope.invitation;
    $('status').hidden=true;
    if(envelope.reply){document.body.dataset.gift=i.giftStyle||'heart';$('content').hidden=false;text('reveal-caption','Two perspectives. One passage. Room for both.');}
    else showGift(i);
    text('from',i.senderName?'AN INVITATION FROM '+i.senderName:'A MOMENT SOMEONE WANTED TO SHARE');
    text('note',i.note||'I wanted to read this with you.');text('reference',reference(i));
    for(const v of i.verses){const p=document.createElement('p'),number=document.createElement('span');number.className='verse';number.textContent=v.verse;p.append(number,document.createTextNode(v.text));$('verses').append(p);}
    text('takeaway-title',i.takeawayTitle);text('takeaway',i.takeaway);$('takeaway-card').hidden=!i.takeaway;
    text('question',i.question);$('guide-art').src='/together/assets/'+i.characterID+'.png';$('guide-art').alt='Illustration of '+names[i.characterID];
    if(i.perspective){$('sender-perspective').hidden=false;text('sender-title',(i.senderName||'Their')+' shared perspective');text('sender-words',i.perspective);}
    for(const character of characters){const o=document.createElement('option');o.value=character;o.textContent=names[character];$('character').append(o);}$('character').value='ruth';
    openApp(location.href);remember(envelope);
    if(i.conversation){$('reply-form').hidden=true;if(envelope.reply)startLiveConversation();}
    if(envelope.reply){const r=envelope.reply;$('reply-form').hidden=true;$('received-perspective').hidden=false;text('reader-title',(r.readerName||'The other reader')+"'s perspective");text('reader-words',r.perspective);text('guide-words','Two perspectives can sit side by side. What connects, and what do you see differently?');}
  }catch{text('status','This invitation is incomplete or could not be opened. Ask for a fresh gift link.');$('status').hidden=false;$('gift-stage').hidden=true;$('content').hidden=true;}
}
$('preview').addEventListener('click',async()=>{
  const perspective=$('perspective').value.trim();if(!perspective){$('perspective').focus();return;}
  try{
    const reply={id:crypto.randomUUID(),createdAt:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),invitation:envelope.invitation,readerName:$('name').value.trim(),perspective,characterID:$('character').value,allowsKeeping:true};
    const e={version:1,invitation:envelope.invitation,reply};replyURL=await encode(e,location.origin);
    text('reply-words',perspective);text('reply-consent','Saved on this browser automatically. Only these words are included in your reply.');
    $('reply-form').hidden=true;$('reply-preview').hidden=false;remember(e);openApp(replyURL);$('reply-preview').scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});
  }catch(error){text('status',error.message);$('status').hidden=false;}
});
$('edit').addEventListener('click',()=>{$('reply-form').hidden=false;$('reply-preview').hidden=true;replyURL=undefined;openApp(location.href);});
$('share').addEventListener('click',async()=>{if(!replyURL)return;try{if(navigator.share)await navigator.share({title:'Our perspectives · Bible Companion',text:'I wanted to share what stood out to me.',url:replyURL});else await copyReply();}catch(error){if(error.name!=='AbortError')await copyReply();}});
function showManual(url){$('manual-copy').hidden=false;$('reply-url').value=url;$('reply-url').select();}
async function copyReply(){if(!replyURL)return;try{await navigator.clipboard.writeText(replyURL);$('copy').textContent='Reply link copied';}catch{showManual(replyURL);}}
$('copy').addEventListener('click',copyReply);
window.addEventListener('hashchange',()=>location.reload());
load();
