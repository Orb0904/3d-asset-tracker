const STORAGE_KEY = "web_3d_asset_tracker_v1";
const PROJECT_KEY = "web_3d_asset_tracker_project_v1";
const STAGES = ["BO","High","Low","UV","Bake","Texture","Export"];
const STATUSES = ["To do","Doing","Waiting FB","Done"];

let assets = loadAssets();

function uid(){
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
}
function emptyAsset(){
  const stages={};
  STAGES.forEach(s=>stages[s]="To do");
  return {id:uid(),name:"New Asset",note:"",image:"",stages};
}
function loadAssets(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return [emptyAsset()];
    const data=JSON.parse(raw);
    return Array.isArray(data)?data:[emptyAsset()];
  }catch{return [emptyAsset()]}
}
function save(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(assets));
  render();
}
function statusClass(s){
  if(s==="Doing") return "doing";
  if(s==="Waiting FB") return "waiting";
  if(s==="Done") return "done";
  return "";
}
function pct(a){
  return Math.round(STAGES.filter(s=>a.stages[s]==="Done").length/STAGES.length*100);
}
function currentBucket(a){
  if(STAGES.every(s=>a.stages[s]==="Done")) return "done";
  if(STAGES.some(s=>a.stages[s]==="Waiting FB")) return "waiting";
  if(STAGES.some(s=>a.stages[s]==="Doing")) return "doing";
  return "todo";
}
function render(){
  const list=document.getElementById("assetList");
  const q=document.getElementById("search").value.toLowerCase().trim();
  const filter=document.getElementById("filter").value;
  list.innerHTML="";

  assets
    .filter(a=>a.name.toLowerCase().includes(q))
    .filter(a=>filter==="all" || currentBucket(a)===filter)
    .forEach(asset=>list.appendChild(renderAsset(asset)));

  document.getElementById("statTotal").textContent=assets.length;
  document.getElementById("statDoing").textContent=assets.filter(a=>currentBucket(a)==="doing").length;
  document.getElementById("statWaiting").textContent=assets.filter(a=>currentBucket(a)==="waiting").length;
  document.getElementById("statDone").textContent=assets.filter(a=>currentBucket(a)==="done").length;
}
function renderAsset(asset){
  const tpl=document.getElementById("assetTemplate");
  const node=tpl.content.firstElementChild.cloneNode(true);

  const name=node.querySelector(".asset-name");
  const note=node.querySelector(".asset-note");
  name.value=asset.name;
  note.value=asset.note||"";

  name.addEventListener("change",()=>{asset.name=name.value.trim()||"Unnamed Asset";save()});
  note.addEventListener("change",()=>{asset.note=note.value;save()});

  const img=node.querySelector(".thumb");
  const ph=node.querySelector(".thumb-placeholder");
  const btn=node.querySelector(".thumb-btn");
  const file=node.querySelector(".image-input");

  if(asset.image){
    img.src=asset.image; img.style.display="block"; ph.style.display="none";
    img.addEventListener("click",(e)=>{e.stopPropagation();openModal(asset.image)});
  }
  btn.addEventListener("click",()=>file.click());
  file.addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{asset.image=r.result;save()};
    r.readAsDataURL(f);
  });

  const row=node.querySelector(".stage-row");
  STAGES.forEach(stage=>{
    const box=document.createElement("div");
    box.className="stage";
    const label=document.createElement("label"); label.textContent=stage;
    const sel=document.createElement("select");
    STATUSES.forEach(s=>{
      const o=document.createElement("option");o.value=s;o.textContent=s;
      if(asset.stages[stage]===s)o.selected=true;
      sel.appendChild(o);
    });
    sel.className=statusClass(asset.stages[stage]);
    sel.addEventListener("change",()=>{asset.stages[stage]=sel.value;save()});
    box.append(label,sel); row.appendChild(box);
  });

  const p=pct(asset);
  node.querySelector(".progress-text").textContent=p+"%";
  node.querySelector(".progress span").style.width=p+"%";

  node.querySelector(".remove").addEventListener("click",()=>{
    if(confirm("Delete "+asset.name+"?")){
      assets=assets.filter(a=>a.id!==asset.id);save();
    }
  });
  return node;
}
function openModal(src){
  const m=document.getElementById("imageModal");
  document.getElementById("modalImg").src=src;
  m.classList.add("open");m.setAttribute("aria-hidden","false");
}
function closeModal(){
  const m=document.getElementById("imageModal");
  m.classList.remove("open");m.setAttribute("aria-hidden","true");
}
document.getElementById("closeModal").addEventListener("click",closeModal);
document.getElementById("imageModal").addEventListener("click",e=>{if(e.target.id==="imageModal")closeModal()});

document.getElementById("addAsset").addEventListener("click",()=>{assets.push(emptyAsset());save()});
document.getElementById("search").addEventListener("input",render);
document.getElementById("filter").addEventListener("change",render);

const projectName=document.getElementById("projectName");
projectName.value=localStorage.getItem(PROJECT_KEY)||"ThetaPixalator";
projectName.addEventListener("change",()=>localStorage.setItem(PROJECT_KEY,projectName.value));

document.getElementById("exportBtn").addEventListener("click",()=>{
  const payload={project:projectName.value,assets};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="3d-production-board.json";a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("importBtn").addEventListener("click",()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    if(data.project) projectName.value=data.project;
    if(Array.isArray(data.assets)) assets=data.assets;
    localStorage.setItem(PROJECT_KEY,projectName.value);
    save();
  }catch{alert("JSON không hợp lệ")}
  e.target.value="";
});
render();
