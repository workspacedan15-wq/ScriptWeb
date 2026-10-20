import { firebaseConfig, firebaseReady } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const state = { scripts: [], view: "dashboard", user: null, db: null, auth: null, unsub: null, detailId: null, localMode: !firebaseReady, selectedPublisher: "" };
const PUBLISHERS = ["KARYA DOSEN","AMERTA MEDIA","DIVA PUSTAKA","SKETSA MEDIA","ARTA MEDIA","RAYAZ MEDIA","JOGJA ILMU MEDIA","HISTORIE MEDIA"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const fmtDate = (s, opts={day:"numeric",month:"short",year:"numeric"}) => { if(!s) return "Tanggal belum diatur"; const d=new Date(`${s}T00:00:00`); return isNaN(d) ? s : new Intl.DateTimeFormat("id-ID",opts).format(d); };
const monthKey = (s) => (s || "").slice(0,7);
const escapeHtml = (s="") => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initial = (s="P") => String(s).trim().charAt(0).toUpperCase() || "P";
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const timeNow = () => `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;
const showToast = (msg, type="") => { const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=msg; $("toast-root").append(el); setTimeout(()=>el.remove(),3300); };
const loadLocal = () => { try { return JSON.parse(localStorage.getItem("scriptStudioScripts")||"[]"); } catch { return []; } };
const saveLocal = () => localStorage.setItem("scriptStudioScripts", JSON.stringify(state.scripts));
function normalizeScript(s){ return { id:s.id, title:s.title||"Tanpa judul", publisher:s.publisher||"Penerbit", date:s.date||today(), time:s.time||"09:00", reference:s.reference||"", brief:s.brief||"", rows:Array.isArray(s.rows)?s.rows:[], createdAt:s.createdAt||Date.now(), updatedAt:s.updatedAt||Date.now(), createdBy:s.createdBy||"" }; }
function renderAll(){ renderStats(); renderRecent(); renderGroups(); updateFilters(); $("nav-script-count").textContent=state.scripts.length; $("sync-status").textContent=state.localMode?"Mode demo lokal": "Terhubung ke Firebase"; }
function renderStats(){
  $("stat-total").textContent=state.scripts.length;
  const now=today().slice(0,7); $("stat-month").textContent=state.scripts.filter(s=>monthKey(s.date)===now).length;
  $("stat-month-label").textContent=MONTHS[new Date().getMonth()]+" "+new Date().getFullYear();
  $("stat-rows").textContent=state.scripts.reduce((n,s)=>n+s.rows.length,0);
}
function cardMarkup(s){
  const rowsCount=s.rows.length;
  return `<article class="script-card" data-open="${escapeHtml(s.id)}" tabindex="0" role="button" aria-label="Buka skrip ${escapeHtml(s.title)}">
    <div class="card-top"><span class="date-pill">◷ &nbsp;${escapeHtml(fmtDate(s.date))} · ${escapeHtml(s.time||"")}</span><button class="card-menu" data-menu="${escapeHtml(s.id)}" aria-label="Edit skrip">···</button></div>
    <h3>${escapeHtml(s.title)}</h3><p class="card-brief">${escapeHtml(s.brief||"Belum ada catatan brief.")}</p>
    <div class="card-divider"></div><div class="card-meta"><div class="publisher"><span class="publisher-avatar">${escapeHtml(initial(s.publisher))}</span><span>${escapeHtml(s.publisher)}</span></div><span class="row-count">▤ &nbsp;${rowsCount} baris VO</span></div></article>`;
}
function renderRecent(){
  const items=[...state.scripts].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,3);
  $("recent-scripts").innerHTML=items.map(cardMarkup).join("");
  $("dashboard-empty").classList.toggle("hidden",state.scripts.length!==0);
  $("recent-scripts").classList.toggle("hidden",state.scripts.length===0);
}
function updateFilters(){
  const month=$("month-filter").value, pub=$("publisher-filter").value;
  const months=[...new Set(state.scripts.map(s=>monthKey(s.date)).filter(Boolean))].sort().reverse();
  $("month-filter").innerHTML='<option value="">Semua bulan</option>'+months.map(m=>{const [y,mo]=m.split("-");return `<option value="${m}">${MONTHS[Number(mo)-1]} ${y}</option>`}).join("");
  $("month-filter").value=months.includes(month)?month:"";
  const pubs=[...new Set(state.scripts.map(s=>s.publisher).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
  $("publisher-filter").innerHTML='<option value="">Semua penerbit</option>'+pubs.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  $("publisher-filter").value=pubs.includes(pub)?pub:"";
}
function renderGroups(){
  const search=$("search-input").value.trim().toLowerCase(), month=$("month-filter").value, publisher=$("publisher-filter").value;
  const filtered=state.scripts.filter(s=>{
    const hay=[s.title,s.publisher,s.brief,...s.rows.flatMap(r=>[r.visual,r.vo])].join(" ").toLowerCase();
    return (!search||hay.includes(search))&&(!month||monthKey(s.date)===month)&&(!publisher||s.publisher===publisher);
  }).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.time||"").localeCompare(a.time||""));
  const groups={};
  filtered.forEach(s=>{const key=monthKey(s.date)||"unknown";(groups[key] ||= []).push(s);});
  $("script-groups").innerHTML=Object.keys(groups).sort().reverse().map(key=>{
    const [y,m]=key.split("-"); const label=key==="unknown"?"Tanggal belum diatur":`${MONTHS[Number(m)-1]} ${y}`;
    return `<section class="group-block"><div class="group-title"><h2>${escapeHtml(label)}</h2><span>${groups[key].length} skrip</span></div><div class="group-cards">${groups[key].map(cardMarkup).join("")}</div></section>`;
  }).join("");
  $("scripts-empty").classList.toggle("hidden",filtered.length!==0);
  $("script-groups").classList.toggle("hidden",filtered.length===0);
}
function setView(view){
  state.view=view;
  $("dashboard-view").classList.toggle("hidden",view!=="dashboard");
  $("scripts-view").classList.toggle("hidden",view!=="scripts");
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("breadcrumb-current").textContent=view==="dashboard"?"Dashboard":"Semua Skrip";
  $("sidebar").classList.remove("open");
}
function renderPublisherChoices(){
  const holder=$("publisher-choices");
  holder.innerHTML=PUBLISHERS.map((name,i)=>`<button type="button" class="publisher-choice" data-publisher="${escapeHtml(name)}"><span class="publisher-choice-number">0${i+1}</span><span>${escapeHtml(name)}</span><span class="publisher-choice-arrow">↗</span></button>`).join("");
  holder.querySelectorAll("[data-publisher]").forEach(btn=>btn.addEventListener("click",()=>choosePublisher(btn.dataset.publisher)));
  $("script-publisher").innerHTML=PUBLISHERS.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
}
function showPicker(){ $("app").classList.add("hidden"); $("auth-screen").classList.remove("hidden"); }
function choosePublisher(name){
  state.selectedPublisher=name;
  if(!state.user){showToast("Sesi belum siap. Coba lagi sebentar.","error");return;}
  showApp(state.user);
  watchData();
}
function showApp(user){
  state.user=user;
  $("auth-screen").classList.add("hidden"); $("app").classList.remove("hidden");
  const display=state.selectedPublisher || "Pilih Penerbit";
  $("user-name").textContent=display; $("user-email").textContent=email;
  $("welcome-name").textContent=display.split(" ").map(w=>w?initial(w)+w.slice(1):"").join(" ");
  $("avatar").textContent=initial(display); $("top-avatar").textContent=initial(display);
  $("today-label").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date());
  $("year").textContent=new Date().getFullYear();
}
function showAuth(){ $("app").classList.add("hidden"); $("auth-screen").classList.remove("hidden"); }
function watchData(){
  if(state.unsub) state.unsub();
  if(state.localMode){state.scripts=loadLocal().map(normalizeScript);renderAll();return;}
  const q=query(collection(state.db,"scripts"),orderBy("date","desc"));
  state.unsub=onSnapshot(q,snap=>{state.scripts=snap.docs.map(d=>normalizeScript({...d.data(),id:d.id}));renderAll();},err=>{console.error(err);showToast("Gagal memuat data Firebase. Periksa Firestore Rules.","error");});
}
function openEditor(script=null){
  $("script-form").reset(); $("script-id").value=script?.id||"";
  $("modal-title").textContent=script?"Edit skrip":"Buat skrip baru";
  $("script-title").value=script?.title||"";
  $("script-publisher").value=script?.publisher||state.selectedPublisher||PUBLISHERS[0];
  $("script-date").value=script?.date||today(); $("script-time").value=script?.time||timeNow();
  $("script-reference").value=script?.reference||""; $("script-brief").value=script?.brief||"";
  $("editor-rows").innerHTML="";
  (script?.rows?.length?script.rows:[{visual:"",vo:""}]).forEach(addEditorRow);
  $("ai-prompt").value=""; $("ai-status").textContent="";
  $("script-modal").classList.remove("hidden"); document.body.style.overflow="hidden";
  setTimeout(()=>$("script-title").focus(),50);
}
function closeEditor(){ $("script-modal").classList.add("hidden"); document.body.style.overflow=""; }
function addEditorRow(row={visual:"",vo:""}){
  const tr=document.createElement("tr");
  tr.innerHTML=`<td class="row-number"></td><td><textarea class="visual-field" rows="2" placeholder="Contoh: Talent menunjukkan produk ke kamera">${escapeHtml(row.visual||"")}</textarea></td><td><textarea class="vo-field" rows="2" placeholder="Tulis narasi / VO">${escapeHtml(row.vo||"")}</textarea></td><td><button type="button" class="remove-row" title="Hapus baris" aria-label="Hapus baris">×</button></td>`;
  tr.querySelector(".remove-row").addEventListener("click",()=>{tr.remove();renumberRows();});
  $("editor-rows").append(tr);renumberRows();
}
function renumberRows(){[...$("editor-rows").rows].forEach((tr,i)=>tr.querySelector(".row-number").textContent=i+1);}
function collectRows(){return [...$("editor-rows").rows].map(tr=>({visual:tr.querySelector(".visual-field").value.trim(),vo:tr.querySelector(".vo-field").value.trim()})).filter(r=>r.visual||r.vo);}
async function saveScript(e){
  e.preventDefault();
  const id=$("script-id").value;
  const script={title:$("script-title").value.trim(),publisher:$("script-publisher").value.trim(),date:$("script-date").value,time:$("script-time").value,reference:$("script-reference").value.trim(),brief:$("script-brief").value.trim(),rows:collectRows(),updatedAt:Date.now(),createdBy:state.user?.uid||"demo"};
  if(!script.rows.length){showToast("Tambahkan minimal satu baris visual atau VO.","error");return;}
  const btn=$("save-script-btn");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    if(state.localMode){
      const old=state.scripts.find(s=>s.id===id);
      if(id) state.scripts=state.scripts.map(s=>s.id===id?normalizeScript({...script,id,createdAt:old?.createdAt||Date.now()}):s);
      else state.scripts.push(normalizeScript({...script,id:crypto.randomUUID(),createdAt:Date.now()}));
      saveLocal();renderAll();
    }else{
      if(id) await updateDoc(doc(state.db,"scripts",id),script);
      else await addDoc(collection(state.db,"scripts"),{...script,createdAt:serverTimestamp()});
    }
    closeEditor();showToast(id?"Skrip berhasil diperbarui.":"Skrip berhasil disimpan.","success");
  }catch(err){console.error(err);showToast("Gagal menyimpan skrip. Periksa koneksi dan aturan Firebase.","error");}
  finally{btn.disabled=false;btn.innerHTML='Simpan skrip <span>✓</span>';}
}
function openDetail(id){
  const s=state.scripts.find(x=>x.id===id);if(!s)return;state.detailId=id;
  $("detail-title").textContent=s.title;$("detail-meta").textContent=`${s.publisher} · ${fmtDate(s.date)} · ${s.time||"Waktu belum diatur"}`;
  const brief=s.brief?`<div class="detail-brief">${escapeHtml(s.brief)}</div>`:"";
  const ref=s.reference?`<a class="detail-reference" href="${escapeHtml(s.reference)}" target="_blank" rel="noopener noreferrer">↗ Buka link referensi produk</a><br>`:"";
  const rows=s.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.visual||"—")}</td><td>${escapeHtml(r.vo||"—")}</td></tr>`).join("");
  $("detail-content").innerHTML=`${brief}${ref}<div class="table-wrap"><table class="detail-table"><thead><tr><th>No</th><th>Deskripsi Visual (Talent ngapain)</th><th>VO (Voice over)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $("detail-modal").classList.remove("hidden");document.body.style.overflow="hidden";
}
function closeDetail(){$("detail-modal").classList.add("hidden");document.body.style.overflow="";}
async function deleteCurrent(){
  const s=state.scripts.find(x=>x.id===state.detailId);if(!s)return;
  if(!confirm(`Hapus skrip "${s.title}"? Tindakan ini tidak bisa dibatalkan.`))return;
  try{
    if(state.localMode){state.scripts=state.scripts.filter(x=>x.id!==s.id);saveLocal();renderAll();}
    else await deleteDoc(doc(state.db,"scripts",s.id));
    closeDetail();showToast("Skrip dihapus.","success");
  }catch(e){console.error(e);showToast("Gagal menghapus skrip.","error");}
}
async function generateDraft(){
  const prompt=$("ai-prompt").value.trim();if(!prompt){showToast("Tulis perintah teks terlebih dahulu.","error");return;}
  const btn=$("ai-generate-btn");btn.disabled=true;btn.textContent="Memproses...";
  try{
    // Optional secure Gemini proxy. Without GEMINI_API_KEY configured, use a local text-only template.
    const response=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
    if(response.ok){const data=await response.json();if(data.rows?.length){$("editor-rows").innerHTML="";data.rows.forEach(addEditorRow);$("ai-status").textContent="Draft dibuat dengan AI. Periksa dan edit sebelum menyimpan.";return;}}
    throw new Error("AI proxy belum diatur");
  }catch{
    const clean=prompt.replace(/^(tolong|buatkan|buat|bikin|susun)\s+/i,"").replace(/[.!?]+$/,"");
    const product=(clean.match(/(?:untuk|tentang|promosi|produk)\s+(.+)/i)?.[1]||clean).trim();
    const rows=[
      {visual:`Talent membuka video dengan menunjukkan ${product} ke kamera.`,vo:`Lagi cari produk yang praktis untuk kebutuhan sehari-hari? Kenalan dulu dengan ${product}.`},
      {visual:`Talent memperlihatkan detail produk dari dekat dan menunjukkan cara penggunaan.`,vo:`Desain dan fiturnya dibuat untuk membantu aktivitas kamu jadi lebih praktis.`},
      {visual:`Talent mendemonstrasikan produk dalam situasi pemakaian sehari-hari.`,vo:`Kamu bisa melihat cara pakainya dan menyesuaikannya dengan kebutuhanmu.`},
      {visual:`Talent menghadap kamera sambil memegang produk, lalu menunjuk area keranjang atau link produk.`,vo:`Cek detail produk dan pilih sesuai kebutuhan kamu. Klik link produk untuk informasi selengkapnya.`}
    ];
    $("editor-rows").innerHTML="";rows.forEach(addEditorRow);
    $("ai-status").textContent="Draft contoh dibuat secara lokal dari perintah teks (belum memakai model AI). Edit sesuai fakta produk sebelum digunakan.";
  }finally{btn.disabled=false;btn.textContent="Buat draft ↗";}
}
function bindEvents(){
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  $("new-script-top").addEventListener("click",()=>openEditor());$("new-script-list").addEventListener("click",()=>openEditor());$("empty-create").addEventListener("click",()=>openEditor());
  $("see-all").addEventListener("click",()=>setView("scripts"));
  $("close-modal").addEventListener("click",closeEditor);$("cancel-modal").addEventListener("click",closeEditor);
  $("script-modal").addEventListener("click",e=>{if(e.target===$("script-modal"))closeEditor();});
  $("close-detail").addEventListener("click",closeDetail);$("detail-modal").addEventListener("click",e=>{if(e.target===$("detail-modal"))closeDetail();});
  $("add-row-btn").addEventListener("click",()=>addEditorRow());$("script-form").addEventListener("submit",saveScript);
  $("ai-generate-btn").addEventListener("click",generateDraft);
  ["search-input","month-filter","publisher-filter"].forEach(id=>$(id).addEventListener(id==="search-input"?"input":"change",renderGroups));
  $("detail-edit").addEventListener("click",()=>{const s=state.scripts.find(x=>x.id===state.detailId);closeDetail();if(s)openEditor(s);});
  $("detail-delete").addEventListener("click",deleteCurrent);
  $("signout-btn").addEventListener("click",()=>{showPicker();});
  $("menu-toggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.addEventListener("click",e=>{
    const open=e.target.closest("[data-open]");if(open&&!e.target.closest("[data-menu]"))openDetail(open.dataset.open);
    const menu=e.target.closest("[data-menu]");if(menu){e.stopPropagation();const s=state.scripts.find(x=>x.id===menu.dataset.menu);if(s)openEditor(s);}
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeEditor();closeDetail();}});

}
async function init(){
  bindEvents();
  renderPublisherChoices();
  if(state.localMode){
    state.user={uid:"demo-anonymous",email:null};
    state.scripts=loadLocal().map(normalizeScript);
    $("sync-status").textContent="Mode demo lokal — data hanya di browser ini";
    renderAll();
    showPicker();
  }else{
    try{
      const app=initializeApp(firebaseConfig);state.auth=getAuth(app);state.db=getFirestore(app);
      onAuthStateChanged(state.auth,async user=>{
        if(user){state.user=user;showPicker();}
        else {try{await signInAnonymously(state.auth);}catch(e){console.error(e);$("auth-error").textContent="Tidak bisa mengaktifkan sesi otomatis. Aktifkan Anonymous sign-in di Firebase Authentication.";showPicker();}}
      });
    }catch(e){console.error(e);showPicker();$("auth-error").textContent="Firebase belum dapat diinisialisasi. Periksa firebase-config.js.";}
  }
}
init();
