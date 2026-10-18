const APP_KEY = "web_3d_asset_tracker_multi_v3";
const OLD_ASSET_KEY = "web_3d_asset_tracker_v1";
const OLD_PROJECT_KEY = "web_3d_asset_tracker_project_v1";
const OLD_WORKFLOW_KEY = "web_3d_asset_tracker_workflow_v2";
const STATUSES = ["To do","Doing","Waiting FB","Done"];
const DEFAULT_STAGE_NAMES = ["BO","High","Low","UV","Bake","Texture","Export"];

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()); }
function makeWorkflow(names=DEFAULT_STAGE_NAMES){ return names.map(name=>({id:uid(),name})); }
function makeProject(name="Project Name", workflow=makeWorkflow()){
  return {id:uid(),name,workflow,assets:[]};
}
function makeAsset(project){
  const stages={};
  project.workflow.forEach(s=>stages[s.id]="To do");
  return {id:uid(),name:"New Asset",note:"",image:"",stages};
}

function loadOldSingleProject(){
  try{
    const rawAssets=localStorage.getItem(OLD_ASSET_KEY);
    const oldName=localStorage.getItem(OLD_PROJECT_KEY);
    const rawWorkflow=localStorage.getItem(OLD_WORKFLOW_KEY);

    if(!rawAssets && !rawWorkflow && !oldName) return null;

    let workflow;
    try{
      const w=JSON.parse(rawWorkflow||"null");
      workflow=Array.isArray(w)&&w.length ? w.map(s=>({id:s.id||uid(),name:String(s.name||"Stage")})) : makeWorkflow();
    }catch{ workflow=makeWorkflow(); }

    const project=makeProject((oldName && oldName!=="ThetaPixalator") ? oldName : "Project Name",workflow);

    try{
      const arr=JSON.parse(rawAssets||"[]");
      if(Array.isArray(arr)){
        project.assets=arr.map(a=>migrateAssetToProject(a,project));
      }
    }catch{}

    return project;
  }catch{return null}
}

function migrateAssetToProject(asset,project){
  if(!asset || typeof asset!=="object") return makeAsset(project);
  if(!asset.stages || typeof asset.stages!=="object") asset.stages={};

  const stageNames=project.workflow.map(s=>s.name);
  const keys=Object.keys(asset.stages);
  const looksNameKeyed=keys.some(k=>stageNames.includes(k) || DEFAULT_STAGE_NAMES.includes(k));

  if(looksNameKeyed){
    const old={...asset.stages};
    const migrated={};
    project.workflow.forEach(stage=>migrated[stage.id]=old[stage.name]||"To do");
    asset.stages=migrated;
  }else{
    project.workflow.forEach(stage=>{
      if(!STATUSES.includes(asset.stages[stage.id])) asset.stages[stage.id]="To do";
    });
  }

  asset.id=asset.id||uid();
  asset.name=asset.name||"Unnamed Asset";
  asset.note=asset.note||"";
  asset.image=asset.image||"";
  return asset;
}

function loadApp(){
  try{
    const raw=localStorage.getItem(APP_KEY);
    if(raw){
      const data=JSON.parse(raw);
      if(data && Array.isArray(data.projects) && data.projects.length){
        data.projects.forEach(p=>{
          p.id=p.id||uid();
          p.name=p.name||"Project Name";
          if(!Array.isArray(p.workflow)||!p.workflow.length) p.workflow=makeWorkflow();
          p.workflow=p.workflow.map(s=>({id:s.id||uid(),name:String(s.name||"Stage")}));
          if(!Array.isArray(p.assets)) p.assets=[];
          p.assets=p.assets.map(a=>migrateAssetToProject(a,p));
        });
        if(!data.activeProjectId || !data.projects.some(p=>p.id===data.activeProjectId)){
          data.activeProjectId=data.projects[0].id;
        }
        return data;
      }
    }
  }catch{}

  const migrated=loadOldSingleProject();
  const first=migrated || makeProject();
  if(!first.assets.length) first.assets=[makeAsset(first)];
  return {version:3,activeProjectId:first.id,projects:[first]};
}

let app=loadApp();

function activeProject(){
  return app.projects.find(p=>p.id===app.activeProjectId) || app.projects[0];
}
function persist(renderAfter=true){
  localStorage.setItem(APP_KEY,JSON.stringify(app));
  if(renderAfter) render();
}
function statusClass(s){
  if(s==="Doing") return "doing";
  if(s==="Waiting FB") return "waiting";
  if(s==="Done") return "done";
  return "";
}
function pct(asset,project){
  if(!project.workflow.length) return 0;
  return Math.round(project.workflow.filter(s=>asset.stages[s.id]==="Done").length/project.workflow.length*100);
}
function currentBucket(asset,project){
  if(project.workflow.length && project.workflow.every(s=>asset.stages[s.id]==="Done")) return "done";
  if(project.workflow.some(s=>asset.stages[s.id]==="Waiting FB")) return "waiting";
  if(project.workflow.some(s=>asset.stages[s.id]==="Doing")) return "doing";
  return "todo";
}

function renderProjectTabs(){
  const tabs=document.getElementById("projectTabs");
  tabs.innerHTML="";
  app.projects.forEach(project=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="project-tab"+(project.id===app.activeProjectId?" active":"");
    b.textContent=project.name;
    b.title=project.name;
    b.addEventListener("click",()=>{
      app.activeProjectId=project.id;
      document.getElementById("search").value="";
      document.getElementById("filter").value="all";
      persist();
    });
    tabs.appendChild(b);
  });
}

function render(){
  const project=activeProject();
  if(!project) return;

  renderProjectTabs();

  const projectName=document.getElementById("projectName");
  if(document.activeElement!==projectName) projectName.value=project.name;

  document.getElementById("workflowSummary").textContent =
    project.workflow.length ? project.workflow.map(s=>s.name).join(" → ") : "No workflow stages";

  const list=document.getElementById("assetList");
  const q=document.getElementById("search").value.toLowerCase().trim();
  const filter=document.getElementById("filter").value;
  list.innerHTML="";

  project.assets
    .filter(a=>a.name.toLowerCase().includes(q))
    .filter(a=>filter==="all" || currentBucket(a,project)===filter)
    .forEach(asset=>list.appendChild(renderAsset(asset,project)));

  document.getElementById("statTotal").textContent=project.assets.length;
  document.getElementById("statDoing").textContent=project.assets.filter(a=>currentBucket(a,project)==="doing").length;
  document.getElementById("statWaiting").textContent=project.assets.filter(a=>currentBucket(a,project)==="waiting").length;
  document.getElementById("statDone").textContent=project.assets.filter(a=>currentBucket(a,project)==="done").length;

  document.getElementById("deleteProjectBtn").disabled=app.projects.length<=1;
}

function renderAsset(asset,project){
  migrateAssetToProject(asset,project);
  const tpl=document.getElementById("assetTemplate");
  const node=tpl.content.firstElementChild.cloneNode(true);

  const name=node.querySelector(".asset-name");
  const note=node.querySelector(".asset-note");
  name.value=asset.name; note.value=asset.note||"";
  name.addEventListener("change",()=>{asset.name=name.value.trim()||"Unnamed Asset";persist()});
  note.addEventListener("change",()=>{asset.note=note.value;persist()});

  const img=node.querySelector(".thumb");
  const ph=node.querySelector(".thumb-placeholder");
  const btn=node.querySelector(".thumb-btn");
  const file=node.querySelector(".image-input");
  const removeImage=node.querySelector(".remove-image");

  if(asset.image){
    img.src=asset.image; img.style.display="block"; ph.style.display="none"; removeImage.hidden=false;
    img.addEventListener("click",e=>{e.stopPropagation();openModal(asset.image)});
  }
  btn.addEventListener("click",()=>file.click());
  file.addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=()=>{asset.image=r.result;persist()};
    r.readAsDataURL(f); e.target.value="";
  });
  removeImage.addEventListener("click",()=>{asset.image="";persist()});

  const row=node.querySelector(".stage-row");
  row.style.gridTemplateColumns=`repeat(${Math.max(project.workflow.length,1)},minmax(115px,1fr))`;

  project.workflow.forEach(stage=>{
    const box=document.createElement("div"); box.className="stage";
    const label=document.createElement("label"); label.textContent=stage.name; label.title=stage.name;
    const sel=document.createElement("select");
    STATUSES.forEach(s=>{
      const o=document.createElement("option"); o.value=s; o.textContent=s;
      if(asset.stages[stage.id]===s)o.selected=true;
      sel.appendChild(o);
    });
    sel.className=statusClass(asset.stages[stage.id]);
    sel.addEventListener("change",()=>{asset.stages[stage.id]=sel.value;persist()});
    box.append(label,sel); row.appendChild(box);
  });

  const p=pct(asset,project);
  node.querySelector(".progress-text").textContent=p+"%";
  node.querySelector(".progress span").style.width=p+"%";
  node.querySelector(".remove").addEventListener("click",()=>{
    if(confirm("Delete "+asset.name+"?")){
      project.assets=project.assets.filter(a=>a.id!==asset.id); persist();
    }
  });

  return node;
}

// Project controls
document.getElementById("addProjectBtn").addEventListener("click",()=>{
  const n=app.projects.length+1;
  const p=makeProject("Project "+n);
  p.assets=[makeAsset(p)];
  app.projects.push(p);
  app.activeProjectId=p.id;
  document.getElementById("search").value="";
  document.getElementById("filter").value="all";
  persist();
});

document.getElementById("projectName").addEventListener("change",e=>{
  const p=activeProject();
  p.name=e.target.value.trim()||"Project Name";
  e.target.value=p.name;
  persist();
});

document.getElementById("deleteProjectBtn").addEventListener("click",()=>{
  if(app.projects.length<=1) return;
  const p=activeProject();
  if(confirm(`Delete project "${p.name}" và toàn bộ asset bên trong?`)){
    app.projects=app.projects.filter(x=>x.id!==p.id);
    app.activeProjectId=app.projects[0].id;
    persist();
  }
});

// Image modal
function openModal(src){
  const m=document.getElementById("imageModal");
  document.getElementById("modalImg").src=src;
  m.classList.add("open"); m.setAttribute("aria-hidden","false");
}
function closeModal(){
  const m=document.getElementById("imageModal");
  m.classList.remove("open"); m.setAttribute("aria-hidden","true");
}
document.getElementById("closeModal").addEventListener("click",closeModal);
document.getElementById("imageModal").addEventListener("click",e=>{if(e.target.id==="imageModal")closeModal()});

// Workflow editor
const workflowModal=document.getElementById("workflowModal");
const workflowList=document.getElementById("workflowList");
let draftWorkflow=[],draggingId=null;

function openWorkflowEditor(){
  draftWorkflow=activeProject().workflow.map(s=>({...s}));
  drawWorkflowEditor();
  workflowModal.classList.add("open");
  workflowModal.setAttribute("aria-hidden","false");
}
function closeWorkflowEditor(){
  workflowModal.classList.remove("open");
  workflowModal.setAttribute("aria-hidden","true");
}
function moveDraft(index,delta){
  const target=index+delta;
  if(target<0||target>=draftWorkflow.length)return;
  const [item]=draftWorkflow.splice(index,1);
  draftWorkflow.splice(target,0,item);
  drawWorkflowEditor();
}
function drawWorkflowEditor(){
  workflowList.innerHTML="";
  draftWorkflow.forEach((stage,index)=>{
    const item=document.createElement("div");
    item.className="workflow-item"; item.draggable=true; item.dataset.id=stage.id;

    const handle=document.createElement("div");
    handle.className="drag-handle"; handle.textContent="☰"; handle.title="Kéo để đổi vị trí";

    const input=document.createElement("input");
    input.className="workflow-name"; input.value=stage.name;
    input.addEventListener("input",()=>stage.name=input.value);

    const tools=document.createElement("div"); tools.className="workflow-tools";
    const up=document.createElement("button"); up.type="button"; up.textContent="↑"; up.disabled=index===0;
    up.addEventListener("click",()=>moveDraft(index,-1));
    const down=document.createElement("button"); down.type="button"; down.textContent="↓"; down.disabled=index===draftWorkflow.length-1;
    down.addEventListener("click",()=>moveDraft(index,1));
    const del=document.createElement("button"); del.type="button"; del.textContent="×"; del.className="delete-stage";
    del.addEventListener("click",()=>{
      if(draftWorkflow.length<=1){alert("Workflow phải có ít nhất 1 stage.");return;}
      draftWorkflow.splice(index,1); drawWorkflowEditor();
    });

    tools.append(up,down,del); item.append(handle,input,tools);

    item.addEventListener("dragstart",e=>{
      draggingId=stage.id; item.classList.add("dragging");
      e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",stage.id);
    });
    item.addEventListener("dragend",()=>{draggingId=null;item.classList.remove("dragging")});
    item.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="move"});
    item.addEventListener("drop",e=>{
      e.preventDefault();
      const fromId=draggingId||e.dataTransfer.getData("text/plain");
      const from=draftWorkflow.findIndex(s=>s.id===fromId);
      const to=draftWorkflow.findIndex(s=>s.id===stage.id);
      if(from<0||to<0||from===to)return;
      const [moved]=draftWorkflow.splice(from,1);
      draftWorkflow.splice(to,0,moved);
      drawWorkflowEditor();
    });

    workflowList.appendChild(item);
  });
}
document.getElementById("editWorkflowBtn").addEventListener("click",openWorkflowEditor);
document.getElementById("closeWorkflow").addEventListener("click",closeWorkflowEditor);
workflowModal.addEventListener("click",e=>{if(e.target===workflowModal)closeWorkflowEditor()});
document.getElementById("addStageBtn").addEventListener("click",()=>{draftWorkflow.push({id:uid(),name:"New Stage"});drawWorkflowEditor()});
document.getElementById("resetWorkflowBtn").addEventListener("click",()=>{
  if(confirm("Reset workflow về BO → High → Low → UV → Bake → Texture → Export?")){
    draftWorkflow=makeWorkflow(); drawWorkflowEditor();
  }
});
document.getElementById("saveWorkflowBtn").addEventListener("click",()=>{
  const cleaned=draftWorkflow.map(s=>({id:s.id||uid(),name:String(s.name||"").trim()})).filter(s=>s.name);
  if(!cleaned.length){alert("Workflow phải có ít nhất 1 stage.");return;}

  const seen=new Set();
  for(const s of cleaned){
    const key=s.name.toLowerCase();
    if(seen.has(key)){alert("Tên stage không nên trùng nhau: "+s.name);return;}
    seen.add(key);
  }

  const p=activeProject();
  const newIds=new Set(cleaned.map(s=>s.id));
  p.assets.forEach(asset=>{
    cleaned.forEach(stage=>{
      if(!STATUSES.includes(asset.stages[stage.id])) asset.stages[stage.id]="To do";
    });
    Object.keys(asset.stages).forEach(id=>{if(!newIds.has(id))delete asset.stages[id]});
  });
  p.workflow=cleaned;
  closeWorkflowEditor();
  persist();
});

// Asset / filters
document.getElementById("addAsset").addEventListener("click",()=>{
  const p=activeProject(); p.assets.push(makeAsset(p)); persist();
});
document.getElementById("search").addEventListener("input",render);
document.getElementById("filter").addEventListener("change",render);

// Export / Import whole workspace
document.getElementById("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(app,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="3d-production-workspace.json"; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("importBtn").addEventListener("click",()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change",async e=>{
  const f=e.target.files[0]; if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    if(data && Array.isArray(data.projects) && data.projects.length){
      app=data;
      app.projects.forEach(p=>{
        p.id=p.id||uid(); p.name=p.name||"Project Name";
        if(!Array.isArray(p.workflow)||!p.workflow.length)p.workflow=makeWorkflow();
        if(!Array.isArray(p.assets))p.assets=[];
        p.assets=p.assets.map(a=>migrateAssetToProject(a,p));
      });
      if(!app.activeProjectId || !app.projects.some(p=>p.id===app.activeProjectId)) app.activeProjectId=app.projects[0].id;
      persist();
    }else{
      alert("File này không phải workspace multi-project.");
    }
  }catch{alert("JSON không hợp lệ")}
  e.target.value="";
});

persist(false);
render();
