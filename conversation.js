import {validateAccess,validateConversation,sealConversation,openConversation} from './codec.js';
const $=id=>document.getElementById(id);
const STORE='bibleCompanion.conversations.v1';
const safeGet=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch{return false;}};
let viewer=safeGet('bibleCompanion.viewerID');
if(!viewer || !/^[0-9a-f-]{36}$/i.test(viewer)){viewer=crypto.randomUUID();safeSet('bibleCompanion.viewerID',viewer);}
let stopped=false;
window.addEventListener('pagehide',()=>{stopped=true;});
export function stopCurrentConversation(){stopped=true;}
export function forgetCachedConversation(id){
  try{const data=JSON.parse(localStorage.getItem(STORE)||'{"version":1,"items":[]}');if(data.version!==1||!Array.isArray(data.items))return;data.items=data.items.filter(x=>x.conversation?.invitation?.conversation?.id!==id);localStorage.setItem(STORE,JSON.stringify(data));localStorage.removeItem('bibleCompanion.draft.'+id);}catch{}
}
export async function startConversation(invitation){
  const access=validateAccess(invitation.conversation);
  $('chat-card').hidden=false;
  const endpoint='/together/api/conversations/'+encodeURIComponent(access.id.toLowerCase());
  let snapshot,revision=0,sending=false,pending,rendered='';
  const draftKey='bibleCompanion.draft.'+access.id;
  $('chat-name').value=safeGet('bibleCompanion.readerName')||'';
  try{const draft=JSON.parse(safeGet(draftKey)||'{}');$('chat-message').value=typeof draft.text==='string'?draft.text:'';pending=draft.pending;}catch{}
  const keepDraft=()=>safeSet(draftKey,JSON.stringify({text:$('chat-message').value,pending}));
  const status=text=>$('chat-status').textContent=text;
  function cache(value,version){
    try{
      const raw=localStorage.getItem(STORE),data=raw?JSON.parse(raw):{version:1,items:[]};
      if(data.version!==1||!Array.isArray(data.items))throw Error();
      for(const item of data.items){validateConversation(item.conversation,item.conversation.invitation);if(!Number.isInteger(item.revision)||item.revision<1)throw Error();}
      data.items=data.items.filter(x=>x.conversation.invitation.conversation.id.toLowerCase()!==access.id.toLowerCase());
      data.items.unshift({conversation:value,revision:version});localStorage.setItem(STORE,JSON.stringify(data));
    }catch{status('This browser couldn’t save a local copy. Your live conversation is still available from its gift link; existing local data was not replaced.');}
  }
  function render(value){
    const signature=JSON.stringify(value.messages);
    if(signature===rendered)return;rendered=signature;
    const holder=$('chat-messages');holder.replaceChildren();
    if(!value.messages.length){const p=document.createElement('p');p.className='chat-empty';p.textContent='What did this bring to mind? A little thought is a lovely place to start.';holder.append(p);}
    for(const message of value.messages){
      const card=document.createElement('article'),name=document.createElement('span'),words=document.createElement('p'),time=document.createElement('time');
      const mine=message.authorID.toLowerCase()===viewer.toLowerCase();card.className='chat-message'+(mine?' mine':'');
      name.className='eyebrow';name.textContent=mine?'YOU':message.authorName||'YOUR PERSON';words.textContent=message.text;
      time.dateTime=message.createdAt;time.textContent=new Date(message.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
      card.append(name,words,time);holder.append(card);
    }
    if(pending && value.messages.some(m=>m.id===pending.id) && $('chat-message').value.trim()===pending.text){$('chat-message').value='';pending=undefined;keepDraft();}
  }
  async function request(method,body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(endpoint,{method,headers:{Authorization:'Bearer '+access.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if(response.status===409){const error=Error('New messages arrived. Your draft is still here; try Send again.');error.conflict=true;throw error;}
      if(!response.ok)throw Error('The conversation couldn’t connect. Your gift and draft are still here. Try again in a moment.');
      const wire=await response.json();if(!Number.isInteger(wire.revision)||wire.revision<1)throw Error('This conversation could not be verified.');
      const value=await openConversation(wire.payload,invitation);return{value,revision:wire.revision};
    }finally{clearTimeout(timer);}
  }
  async function refresh(){
    try{const result=await request('GET');if(stopped)return; snapshot=result.value;revision=result.revision;status('');render(snapshot);cache(snapshot,revision);$('chat-send').disabled=snapshot.messages.length>=200;if(snapshot.messages.length>=200)status('This conversation is full. A new gift is a lovely way to keep talking.');}
    catch{if(!stopped){status('The conversation couldn’t connect. Your gift and draft are still here. Refresh the page to try again.');$('chat-send').disabled=!snapshot;}}
  }
  $('chat-send').disabled=true;
  $('chat-message').addEventListener('input',keepDraft);
  $('chat-send').addEventListener('click',async()=>{
    const words=$('chat-message').value.trim(),name=$('chat-name').value.trim();
    if(sending||!words||[...words].length>1500||[...name].length>60||!snapshot)return;
    sending=true;$('chat-send').disabled=true;$('chat-message').disabled=true;$('chat-name').disabled=true;status('Sending…');
    if(!pending||pending.text!==words||pending.authorName!==name)pending={id:crypto.randomUUID(),createdAt:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),authorID:viewer,authorName:name,text:words};
    keepDraft();safeSet('bibleCompanion.readerName',name);
    try{
      let sent=false;
      for(let attempt=0;attempt<3;attempt++){
        const latest=await request('GET');if(latest.value.messages.some(x=>x.id===pending.id)){snapshot=latest.value;revision=latest.revision;sent=true;break;}
        if(latest.value.messages.length>=200)throw Error('This conversation is full. Start a new gift to keep talking.');
        latest.value.messages.push(pending);
        try{const result=await request('PUT',{revision:latest.revision,payload:await sealConversation(latest.value)});snapshot=result.value;revision=result.revision;sent=true;break;}
        catch(error){if(!error.conflict||attempt===2)throw error;}
      }
      if(sent){$('chat-message').value='';pending=undefined;keepDraft();status('Sent · saved automatically');render(snapshot);cache(snapshot,revision);}
    }catch(error){status(error.message||'Your message couldn’t send. Your draft is still here.');}
    finally{sending=false;$('chat-send').disabled=!snapshot||snapshot.messages.length>=200;$('chat-message').disabled=false;$('chat-name').disabled=false;}
  });
  await refresh();
  while(!stopped){await new Promise(resolve=>setTimeout(resolve,6000));if(!document.hidden&&!sending)await refresh();}
}
