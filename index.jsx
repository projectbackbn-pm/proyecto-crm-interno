import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, FileText, Settings, HelpCircle, Briefcase,
  DollarSign, TrendingUp, TrendingDown, BarChart2, Plus, ArrowLeft,
  Trash2, ChevronRight, ChevronDown, ChevronUp, Search, CheckCircle,
  Printer, FolderOpen, Zap, Upload, Building2,
} from "lucide-react";

// ── Utils ─────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtARS = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n||0);
const fmtK = n => { const a=Math.abs(n); if(a>=1e6)return`${n<0?"-":""}$${(a/1e6).toFixed(1)}M`; if(a>=1e3)return`${n<0?"-":""}$${(a/1e3).toFixed(0)}K`; return fmtARS(n); };
const today = () => new Date().toISOString().slice(0,10);
const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const RESOURCE_TYPES=["Diseñador","Desarrollador","PM","Sales Rep","Soporte"];

// ── Design tokens ─────────────────────────────────────────────────────────────
const C={
  bg:"#F0F3FA",white:"#FFFFFF",border:"#E8EBF4",shadow:"0 1px 4px rgba(0,0,0,0.06)",
  purple:"#5B4CF5",purpleLight:"rgba(91,76,245,0.09)",
  green:"#16A34A",greenBg:"#DCFCE7",red:"#DC2626",redBg:"#FEE2E2",
  violet:"#7C3AED",violetBg:"#EDE9FE",amber:"#D97706",amberBg:"#FEF3C7",
  blue:"#2563EB",blueBg:"#DBEAFE",text:"#111827",textSub:"#6B7280",textMuted:"#9CA3AF",
};

// ── Calculations ──────────────────────────────────────────────────────────────
const maintCost = c => {
  const r=(c.maintenance?.resources||[]).reduce((s,r)=>s+(+r.hourlyRate||0)*(+r.hours||0),0);
  const sb=(c.maintenance?.subscriptions||[]).filter(x=>x.isRegular).reduce((s,x)=>s+(+x.cost||0),0);
  return r+sb;
};
const maintIncome = c => (+c.maintenance?.monthlyFixed||0)+(+c.maintenance?.monthlyVariable||0);
const implCalc = impl => {
  const r=(impl.resources||[]).reduce((s,r)=>s+(+r.hourlyRate||0)*(+r.hours||0),0);
  const o=(impl.otherCosts||[]).reduce((s,o)=>s+(+o.amount||0),0);
  const cost=r+o; const income=+impl.income||0;
  return {cost,income,margin:income-cost};
};
const allImpls = clients => {
  const out=[];
  for(const c of clients) for(const p of(c.projects||[])) for(const impl of(p.implementations||[]))
    out.push({client:c,project:p,impl});
  return out;
};

// calcItemAmount: extra_users can be prorated (sub-option), legacy prorated_users still works
const calcItemAmount = item => {
  if(item.type==="prorated_users" || (item.type==="extra_users" && item.prorated))
    return (+item.qty||0)*(+item.daysActive||0)/(+item.daysInMonth||30)*(+item.unitPrice||0);
  return (+item.qty||0)*(+item.unitPrice||0);
};

// ── CSV helpers ───────────────────────────────────────────────────────────────
const parseCSV = text => {
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return{headers:[],rows:[]};
  const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").toLowerCase().replace(/\s+/g,"_"));
  const rows=lines.slice(1).map(line=>{
    const vals=[];let cur="",inQ=false;
    for(const ch of line){if(ch==='"'){inQ=!inQ;}else if(ch===","&&!inQ){vals.push(cur.trim());cur="";}else{cur+=ch;}}
    vals.push(cur.trim());
    const obj={};headers.forEach((h,i)=>obj[h]=(vals[i]||"").replace(/^"|"$/g,"").trim());
    return obj;
  }).filter(r=>Object.values(r).some(v=>v));
  return{headers,rows};
};
const calcDaysActiveInMonth = (jStr,lStr,year,month) => {
  const dim=new Date(year,month,0).getDate();
  const mS=new Date(year,month-1,1),mE=new Date(year,month-1,dim);
  const j=jStr?new Date(jStr):mS, l=lStr?new Date(lStr):mE;
  if(isNaN(j)||isNaN(l))return dim;
  const eS=j>mS?j:mS, eE=l<mE?l:mE;
  if(eS>eE)return 0;
  return Math.round((eE-eS)/86400000)+1;
};
const gc=(h,keys)=>keys.find(k=>h.includes(k))||"";
const guessClientIdCol=h=>gc(h,["client_id","clientid","client","empresa","company","tenant","cuenta"])||h[0];
const guessEmailCol=h=>gc(h,["email","user_email","correo","mail","usuario"]);
const guessJoinedCol=h=>gc(h,["joined_date","joined","created_at","start_date","alta","ingreso","desde"]);
const guessLeftCol=h=>gc(h,["left_date","left","end_date","churned_at","baja","egreso","hasta"]);

// ── Blank objects ─────────────────────────────────────────────────────────────
const blankClient = () => ({
  id:uid(),name:"",company:"",email:"",phone:"",notes:"",active:true,
  maintenance:{monthlyFixed:0,monthlyVariable:0,resources:[],subscriptions:[]},
  projects:[],maintenanceInvoices:[],implInvoices:[],
  createdAt:new Date().toISOString(),
});
const blankProject   = () => ({id:uid(),name:"",description:"",implementations:[]});
const blankImpl      = () => ({id:uid(),name:"",description:"",income:0,resources:[],otherCosts:[],invoiceStatus:"pending",createdAt:new Date().toISOString()});
const blankConfig    = () => ({
  company:{name:"Mi Empresa",email:"",phone:"",address:"",cuit:"",logo:""},
  invoice:{showLogo:true,showCompanyName:true,showEmail:true,showInvoiceNumber:true,showDate:true,showPeriod:true,showItemType:true,showItemDetail:true,showTotal:true,showFooter:true},
});

// ── Invoice PDF ───────────────────────────────────────────────────────────────
const ITEM_BADGES={fixed:"Mant. fijo",support_hours:"Hs. soporte",extra_users:"Usr. extra",prorated_users:"Proporcional"};
const getItemDetail = item => {
  if(item.type==="prorated_users"||(item.type==="extra_users"&&item.prorated))
    return `${+item.qty||0} usu. × ${+item.daysActive||0}/${+item.daysInMonth||30} días`;
  if(item.type==="support_hours") return `${+item.qty||0} hora${+item.qty!==1?"s":""}`;
  return `Cant. ${+item.qty||0}`;
};

function printInvoice({invoiceId,type,client,amount,period,lineItems,detail,config={},customFields={}}) {
  const w=window.open("","_blank","width=820,height=980");
  if(!w){alert("Permitir ventanas emergentes para generar la factura");return;}
  const cfg={...blankConfig().invoice,...(config.invoice||{})};
  const co={...blankConfig().company,...(config.company||{})};
  const total=lineItems?.length?lineItems.reduce((s,i)=>s+calcItemAmount(i),0):amount;
  const tHead=lineItems?.length
    ?`<tr><th>Descripción</th>${cfg.showItemType?"<th>Tipo</th>":""}${cfg.showItemDetail?"<th>Detalle</th>":""}<th style="text-align:right">Importe</th></tr>`
    :`<tr><th>Descripción</th>${cfg.showItemType?"<th>Tipo</th>":""}${period&&cfg.showPeriod?"<th>Período</th>":""}<th style="text-align:right">Importe</th></tr>`;
  const tBody=lineItems?.length
    ?lineItems.map(i=>`<tr><td><strong>${i.label}</strong></td>${cfg.showItemType?`<td><span class="badge">${ITEM_BADGES[i.type]||i.type}</span></td>`:""}${cfg.showItemDetail?`<td style="color:#6B7280;font-size:12px">${getItemDetail(i)}</td>`:""}<td style="text-align:right;font-weight:700">${fmtARS(calcItemAmount(i))}</td></tr>`).join("")
    :`<tr><td>${detail||""}</td>${cfg.showItemType?`<td><span class="badge">${type==="maintenance"?"Mantenimiento":"Implementación"}</span></td>`:""}${period&&cfg.showPeriod?`<td style="color:#6B7280">${period}</td>`:""}<td style="text-align:right;font-weight:700">${fmtARS(amount)}</td></tr>`;
  const logoHtml=cfg.showLogo&&co.logo?`<img src="${co.logo}" style="height:44px;object-fit:contain;margin-bottom:6px"/><br/>`:"";
  const companyHtml=cfg.showCompanyName?`<div style="font-size:20px;font-weight:800;color:#5B4CF5">${co.name}</div>`:"";
  const emailHtml=cfg.showEmail&&co.email?`<div style="font-size:11px;color:#9CA3AF">${co.email}</div>`:"";
  const invNumHtml=cfg.showInvoiceNumber?`<div class="ml">N° Factura</div><div class="mv">${invoiceId}</div>`:"";
  const dateHtml=cfg.showDate?`<div class="ml" style="margin-top:10px">Fecha</div><div class="mv">${new Date().toLocaleDateString("es-AR")}</div>`:"";
  const periodHtml=period&&cfg.showPeriod?`<div class="ml" style="margin-top:10px">Período</div><div class="mv">${period}</div>`:"";
  const descHtml=customFields.descripcion?`<div style="margin-bottom:28px;padding:14px;background:#F8FAFF;border-radius:8px;font-size:13px;color:#374151">${customFields.descripcion}</div>`:"";
  const totalBlock=cfg.showTotal?`<div class="ttl"><div class="ttl-l">Total a pagar</div><div class="ttl-v">${fmtARS(total)}</div></div>`:"";
  const footHtml=cfg.showFooter?`<div class="foot">Generado con Admin Dash · ${new Date().toLocaleDateString("es-AR",{year:"numeric",month:"long",day:"numeric"})}</div>`:"";
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Factura</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;color:#111;padding:60px;background:#fff}.w{max-width:680px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px}.ml{font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}.mv{font-size:14px;font-weight:700}hr{border:none;border-top:1px solid #ECEEF6;margin:24px 0}.pty{display:flex;justify-content:space-between;margin-bottom:40px}.pl{font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}.pn{font-size:16px;font-weight:800}.pd{font-size:12px;color:#6B7280;margin-top:3px}table{width:100%;border-collapse:collapse;margin:0 0 28px}th{padding:10px 14px;text-align:left;background:#F0F3FA;font-size:10px;color:#6B7280;text-transform:uppercase}td{padding:12px 14px;font-size:13px;border-bottom:1px solid #ECEEF6}.ttl{float:right;background:#F0F3FA;border-radius:10px;padding:18px 24px}.ttl-l{font-size:11px;color:#6B7280}.ttl-v{font-size:26px;font-weight:800;color:#16A34A;margin-top:4px}.foot{clear:both;margin-top:64px;text-align:center;font-size:10px;color:#9CA3AF;padding-top:16px;border-top:1px solid #ECEEF6}.badge{display:inline-block;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:#EDE9FE;color:#7C3AED}
</style></head><body><div class="w">
<div class="hdr"><div>${logoHtml}${companyHtml}${emailHtml}</div><div style="text-align:right">${invNumHtml}${dateHtml}${periodHtml}</div></div>
<hr>
<div class="pty"><div><div class="pl">De</div><div class="pn">${co.name}</div>${co.email?`<div class="pd">${co.email}</div>`:""}</div><div style="text-align:right"><div class="pl">Para</div><div class="pn">${client.name}</div>${client.company?`<div class="pd">${client.company}</div>`:""}${client.email?`<div class="pd">${client.email}</div>`:""}</div></div>
${descHtml}
<table><thead>${tHead}</thead><tbody>${tBody}</tbody></table>
${totalBlock}${footHtml}
</div><script>setTimeout(()=>window.print(),400)</script></body></html>`);
  w.document.close();
}

// ── Common UI ─────────────────────────────────────────────────────────────────
const inp={width:"100%",background:"#F4F6FB",border:`1px solid #E5E7EB`,borderRadius:9,padding:"9px 12px",color:"#111827",fontSize:13,outline:"none",fontFamily:"inherit"};
const sinp={...inp,padding:"6px 10px",fontSize:12}; // small input

function Toggle({value,onChange,label}){return(
  <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>onChange(!value)}>
    <div style={{width:42,height:24,borderRadius:12,flexShrink:0,background:value?C.purple:"#D1D5DB",position:"relative",transition:"background .2s"}}>
      <div style={{position:"absolute",top:3,left:value?21:3,width:18,height:18,borderRadius:"50%",background:"white",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
    </div>
    {label&&<span style={{fontSize:13,color:C.textSub,userSelect:"none"}}>{label}</span>}
  </div>
);}
function Fld({label,hint,children,col}){return(
  <div style={{marginBottom:14,gridColumn:col}}>
    <label style={{display:"block",fontSize:10,color:C.textSub,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
    {children}{hint&&<div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{hint}</div>}
  </div>
);}
function InvBadge({status}){
  const m={pending:{l:"Pendiente",c:C.amber,bg:C.amberBg},invoiced:{l:"Facturado",c:C.blue,bg:C.blueBg},paid:{l:"Pagado",c:C.green,bg:C.greenBg}};
  const s=m[status]||m.pending;
  return <span style={{display:"inline-block",padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:600,border:`1.5px solid ${s.c}`,color:s.c,background:s.bg}}>{s.l}</span>;
}
function StatusBadge({active}){return <span style={{display:"inline-block",padding:"4px 12px",borderRadius:7,fontSize:11,fontWeight:600,border:`1.5px solid ${active?C.green:C.red}`,color:active?C.green:C.red,background:active?C.greenBg:C.redBg}}>{active?"Activo":"Inactivo"}</span>;}
function SummaryBox({items}){return(
  <div style={{background:"#F8FAFF",border:`1px solid ${C.border}`,borderRadius:9,padding:"14px 16px"}}>
    {items.map((x,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:i<items.length-1?7:0,paddingBottom:i<items.length-1?7:0,borderBottom:i<items.length-1?`1px solid ${C.border}`:"none"}}><span style={{color:C.textSub}}>{x.label}</span><span style={{color:x.color||C.text,fontWeight:x.bold?700:600}}>{x.val}</span></div>))}
  </div>
);}
function SecHead({title,action}){return(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
    <div style={{fontSize:11,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:.5}}>{title}</div>
    {action}
  </div>
);}
const STATUS_OPTS=[
  {id:"pending",l:"Pendiente",c:C.amber,bg:C.amberBg},
  {id:"invoiced",l:"Facturado",c:C.blue,bg:C.blueBg},
  {id:"paid",l:"Pagado",c:C.green,bg:C.greenBg},
];
function StatusPicker({value,onChange}){return(
  <div style={{display:"flex",gap:5}}>
    {STATUS_OPTS.map(s=>(<button key={s.id} onClick={()=>onChange(s.id)} style={{padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:`1.5px solid ${value===s.id?s.c:C.border}`,background:value===s.id?s.bg:C.white,color:value===s.id?s.c:C.textSub,transition:"all .15s"}}>{s.l}</button>))}
  </div>
);}

// ── Invoice types ─────────────────────────────────────────────────────────────
const TYPE_META={
  fixed:         {label:"Mantenimiento fijo", badge:"Mant. fijo",  color:C.blue,   bg:C.blueBg  },
  support_hours: {label:"Horas de soporte",   badge:"Hs. soporte", color:C.violet, bg:C.violetBg},
  extra_users:   {label:"Usuario extra",       badge:"Usr. extra",  color:C.green,  bg:C.greenBg },
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({view,onNav}){
  const items=[
    {id:"dashboard",label:"Dashboard",    Icon:LayoutDashboard},
    {id:"clients",  label:"Clientes",     Icon:Users           },
    {id:"billing",  label:"Facturación",  Icon:FileText        },
    {id:"settings", label:"Configuración",Icon:Settings        },
    {id:"help",     label:"Ayuda",        Icon:HelpCircle,disabled:true},
  ];
  return(
  <aside style={{width:232,flexShrink:0,background:C.white,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",minHeight:"100vh",position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
    <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Briefcase size={17} color="white"/></div>
        <div><div style={{fontSize:14,fontWeight:800,color:C.text,letterSpacing:"-.3px"}}>Admin Dash</div><div style={{fontSize:10,color:C.textMuted}}>v 2.0</div></div>
      </div>
    </div>
    <nav style={{flex:1,padding:"12px 10px"}}>
      {items.map(({id,label,Icon,disabled})=>{
        const active=view===id||(view==="client-form"&&id==="clients");
        return (<button key={id} onClick={()=>!disabled&&onNav(id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 12px",background:active?C.purple:"transparent",border:"none",borderRadius:10,color:active?"white":disabled?C.textMuted:C.textSub,fontSize:13,fontWeight:active?600:400,cursor:disabled?"default":"pointer",marginBottom:3,opacity:disabled?.4:1,textAlign:"left",transition:"background .15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}><Icon size={15}/>{label}</div>
          {!active&&!disabled&&<ChevronRight size={12}/>}
        </button>);
      })}
    </nav>
    <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:32,height:32,borderRadius:"50%",background:C.purpleLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.purple,flexShrink:0}}>AD</div>
      <div><div style={{fontSize:12,fontWeight:600,color:C.text}}>Mi Empresa</div><div style={{fontSize:10,color:C.textMuted}}>Administrador</div></div>
    </div>
  </aside>
);}

// ── KPI + Dashboard ───────────────────────────────────────────────────────────
function KPICard({label,value,sub,positive,Icon,iconBg,iconColor}){return(
  <div style={{flex:1,minWidth:150,background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:"20px",boxShadow:C.shadow}}>
    <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
      <div style={{width:48,height:48,borderRadius:"50%",flexShrink:0,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={21} color={iconColor}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:11,color:C.textSub,marginBottom:5}}>{label}</div>
        <div style={{fontSize:22,fontWeight:800,color:C.text,lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:11,color:positive===false?C.red:C.green,marginTop:6,display:"flex",alignItems:"center",gap:3}}>{positive===false?<TrendingDown size={11}/>:<TrendingUp size={11}/>}{sub}</div>}
      </div>
    </div>
  </div>
);}

function ClientRow({client,onClick,last}){
  const[hov,setHov]=useState(false);
  const mi=maintIncome(client),mc=maintCost(client);
  const implTotal=(client.projects||[]).flatMap(p=>p.implementations||[]).reduce((s,i)=>s+(+i.income||0),0);
  return (<tr onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{borderBottom:!last?`1px solid ${C.border}`:"none",background:hov?"#F8F9FF":C.white,cursor:"pointer"}}>
    <td style={{padding:"13px 18px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,background:C.purpleLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.purple}}>{(client.name||"?").charAt(0).toUpperCase()}</div><div><div style={{fontWeight:600,fontSize:13,color:C.text}}>{client.name||"(sin nombre)"}</div>{client.company&&<div style={{fontSize:11,color:C.textMuted}}>{client.company}</div>}</div></div></td>
    <td style={{padding:"13px 18px",fontSize:13,color:C.textSub}}>{client.email||"—"}</td>
    <td style={{padding:"13px 18px",fontSize:13,fontWeight:600,color:C.green}}>{fmtARS(mi)}<span style={{fontSize:11,color:C.textMuted,fontWeight:400}}>/mes</span></td>
    <td style={{padding:"13px 18px",fontSize:13,fontWeight:600,color:C.violet}}>{fmtARS(implTotal)}</td>
    <td style={{padding:"13px 18px"}}><span style={{fontSize:13,fontWeight:700,color:mi-mc>=0?C.green:C.red}}>{fmtARS(mi-mc)}</span></td>
    <td style={{padding:"13px 18px"}}><StatusBadge active={client.active}/></td>
  </tr>);
}
function ClientsTable({clients,onSelect}){return(
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
    <thead><tr>{["Cliente","Email","Mant./mes","Implementaciones","Margen mant.","Estado"].map(h=>(<th key={h} style={{padding:"10px 18px",textAlign:"left",color:C.textMuted,fontWeight:500,fontSize:11,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
    <tbody>{clients.map((c,i)=><ClientRow key={c.id} client={c} onClick={()=>onSelect(c.id)} last={i===clients.length-1}/>)}</tbody>
  </table></div>
);}

function Dashboard({clients,onNav}){
  const active=clients.filter(c=>c.active);
  const tMI=active.reduce((s,c)=>s+maintIncome(c),0),tMC=active.reduce((s,c)=>s+maintCost(c),0),margin=tMI-tMC;
  const tImpl=clients.flatMap(c=>(c.projects||[]).flatMap(p=>p.implementations||[])).reduce((s,i)=>s+(+i.income||0),0);
  const projCount=clients.reduce((s,c)=>s+(c.projects||[]).length,0);
  return (<div style={{padding:"26px"}}>
    <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
      <KPICard label="Clientes activos"    value={active.length}  sub={`${clients.length} totales`}              positive      Icon={Users}     iconBg={C.greenBg}  iconColor={C.green} />
      <KPICard label="Mant. ingreso/mes"   value={fmtK(tMI)}     sub={`Anual: ${fmtK(tMI*12)}`}                positive      Icon={DollarSign}iconBg={C.greenBg}  iconColor={C.green} />
      <KPICard label="Mant. costo/mes"     value={fmtK(tMC)}     sub={`Anual: ${fmtK(tMC*12)}`}                positive={false}Icon={BarChart2}iconBg={C.redBg}    iconColor={C.red}   />
      <KPICard label="Margen mant./mes"    value={fmtK(margin)}  sub={tMI>0?`${Math.round(margin/tMI*100)}%`:""} positive={margin>=0}Icon={TrendingUp}iconBg={margin>=0?C.greenBg:C.redBg}iconColor={margin>=0?C.green:C.red}/>
      <KPICard label="Proyectos"           value={projCount}     sub="total registrados"                        positive      Icon={FolderOpen}iconBg={C.violetBg} iconColor={C.violet}/>
      <KPICard label="Impl. ingreso total" value={fmtK(tImpl)}   sub="one-shot acumulado"                       positive      Icon={Zap}       iconBg={C.blueBg}   iconColor={C.blue}  />
    </div>
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>Todos los clientes</div><div style={{fontSize:11,color:C.green,marginTop:2}}>{active.length} activos</div></div>
        <button onClick={()=>onNav("client-form")} style={{background:C.purple,color:"white",border:"none",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Plus size={13}/>Nuevo cliente</button>
      </div>
      {clients.length===0?(<div style={{padding:"52px",textAlign:"center"}}><div style={{width:56,height:56,borderRadius:"50%",background:C.purpleLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Users size={24} color={C.purple}/></div><div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>No hay clientes todavía</div><button onClick={()=>onNav("client-form")} style={{background:C.purple,color:"white",border:"none",borderRadius:9,padding:"9px 22px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Nuevo cliente</button></div>)
      :(<><ClientsTable clients={clients} onSelect={id=>onNav("client-form",id)}/><div style={{padding:"11px 18px",borderTop:`1px solid ${C.border}`,fontSize:11,color:C.textMuted}}>Mostrando {clients.length} clientes</div></>)}
    </div>
  </div>);
}

function ClientsView({clients,onNav}){
  const[q,setQ]=useState("");const[filter,setFilter]=useState("all");
  let fl=clients.filter(c=>`${c.name}${c.company}${c.email}`.toLowerCase().includes(q.toLowerCase()));
  if(filter==="active")fl=fl.filter(c=>c.active);if(filter==="inactive")fl=fl.filter(c=>!c.active);
  return (<div style={{padding:"26px"}}>
    <div style={{marginBottom:22}}><h1 style={{fontSize:19,fontWeight:700,color:C.text}}>Clientes</h1><div style={{fontSize:11,color:C.green,marginTop:3}}>{clients.filter(c=>c.active).length} activos de {clients.length}</div></div>
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:160,position:"relative"}}><Search size={13} color={C.textMuted} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)"}}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." style={{...inp,paddingLeft:30,padding:"8px 12px 8px 30px"}}/></div>
        <div style={{display:"flex",gap:5}}>{[{id:"all",l:"Todos"},{id:"active",l:"Activos"},{id:"inactive",l:"Inactivos"}].map(f=>(<button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"7px 12px",fontSize:11,fontWeight:500,border:`1px solid ${filter===f.id?C.purple:C.border}`,background:filter===f.id?C.purpleLight:C.white,color:filter===f.id?C.purple:C.textSub,borderRadius:7,cursor:"pointer"}}>{f.l}</button>))}</div>
        <button onClick={()=>onNav("client-form")} style={{background:C.purple,color:"white",border:"none",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Plus size={12}/>Nuevo</button>
      </div>
      {fl.length===0?(<div style={{padding:"48px",textAlign:"center",color:C.textMuted,fontSize:13}}>Sin resultados</div>)
      :(<><ClientsTable clients={fl} onSelect={id=>onNav("client-form",id)}/><div style={{padding:"11px 18px",borderTop:`1px solid ${C.border}`,fontSize:11,color:C.textMuted}}>Mostrando {fl.length} de {clients.length}</div></>)}
    </div>
  </div>);
}

// ── Client Form ───────────────────────────────────────────────────────────────
function ClientForm({client,isNew,onSave,onDelete,onBack}){
  const[form,setForm]=useState({...client});const[tab,setTab]=useState("info");
  const[confirmDel,setConfirmDel]=useState(false);const[expandedProj,setExpandedProj]=useState(null);
  const u=(k,v)=>setForm(p=>({...p,[k]:v}));
  const uM=(k,v)=>setForm(p=>({...p,maintenance:{...p.maintenance,[k]:v}}));
  const addRes=()=>uM("resources",[...(form.maintenance.resources||[]),{id:uid(),type:"Desarrollador",hourlyRate:0,hours:0}]);
  const updRes=(id,k,v)=>uM("resources",form.maintenance.resources.map(r=>r.id===id?{...r,[k]:v}:r));
  const delRes=id=>uM("resources",form.maintenance.resources.filter(r=>r.id!==id));
  const addSub=()=>uM("subscriptions",[...(form.maintenance.subscriptions||[]),{id:uid(),name:"",cost:0,isRegular:true}]);
  const updSub=(id,k,v)=>uM("subscriptions",form.maintenance.subscriptions.map(s=>s.id===id?{...s,[k]:v}:s));
  const delSub=id=>uM("subscriptions",form.maintenance.subscriptions.filter(s=>s.id!==id));
  const addProj=()=>{const p=blankProject();setForm(prev=>({...prev,projects:[...(prev.projects||[]),p]}));setExpandedProj(p.id);};
  const updProj=(pid,k,v)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id===pid?{...p,[k]:v}:p)}));
  const delProj=pid=>setForm(prev=>({...prev,projects:prev.projects.filter(p=>p.id!==pid)}));
  const addImpl=pid=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:[...(p.implementations||[]),blankImpl()]})}));
  const updImpl=(pid,iid,k,v)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,[k]:v})})}));
  const delImpl=(pid,iid)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.filter(i=>i.id!==iid)})}));
  const addImplRes=(pid,iid)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,resources:[...(i.resources||[]),{id:uid(),type:"Desarrollador",hourlyRate:0,hours:0}]})})}));
  const updImplRes=(pid,iid,rid,k,v)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,resources:i.resources.map(r=>r.id!==rid?r:{...r,[k]:v})})})}));
  const delImplRes=(pid,iid,rid)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,resources:i.resources.filter(r=>r.id!==rid)})})}));
  const addOC=(pid,iid)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,otherCosts:[...(i.otherCosts||[]),{id:uid(),name:"",amount:0}]})})}));
  const updOC=(pid,iid,oid,k,v)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,otherCosts:i.otherCosts.map(o=>o.id!==oid?o:{...o,[k]:v})})})}));
  const delOC=(pid,iid,oid)=>setForm(prev=>({...prev,projects:prev.projects.map(p=>p.id!==pid?p:{...p,implementations:p.implementations.map(i=>i.id!==iid?i:{...i,otherCosts:i.otherCosts.filter(o=>o.id!==oid)})})}));
  const mRes=(form.maintenance.resources||[]).reduce((s,r)=>s+(+r.hourlyRate||0)*(+r.hours||0),0);
  const mSub=(form.maintenance.subscriptions||[]).filter(s=>s.isRegular).reduce((s,x)=>s+(+x.cost||0),0);
  const mCost=mRes+mSub,mInc=(+form.maintenance.monthlyFixed||0)+(+form.maintenance.monthlyVariable||0),mMargin=mInc-mCost;
  const totalImplInc=(form.projects||[]).flatMap(p=>p.implementations||[]).reduce((s,i)=>s+(+i.income||0),0);
  const addBtn={background:C.purpleLight,color:C.purple,border:`1px solid rgba(91,76,245,.25)`,borderRadius:8,padding:"6px 13px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5};
  const delBtn={background:C.white,border:`1px solid ${C.border}`,color:C.red,borderRadius:7,padding:"7px 9px",cursor:"pointer",display:"flex",alignItems:"center"};
  return (<div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:C.bg}}>
    <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,position:"sticky",top:0,zIndex:10,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={onBack} style={{background:"#F3F4F6",border:"none",color:C.textSub,cursor:"pointer",padding:"7px 9px",borderRadius:8,display:"flex",alignItems:"center"}}><ArrowLeft size={15}/></button><div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{isNew?"Nuevo cliente":(form.name||"Sin nombre")}</div>{!isNew&&form.company&&<div style={{fontSize:11,color:C.textSub}}>{form.company}</div>}</div></div>
      <div style={{display:"flex",alignItems:"center",gap:16}}><Toggle value={form.active} onChange={v=>u("active",v)} label="Contrato activo"/><button onClick={()=>onSave(form)} style={{background:C.purple,color:"white",border:"none",borderRadius:9,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Guardar</button></div>
    </div>
    <div style={{padding:"22px 24px",maxWidth:860}}>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[{label:"Mant. ingreso/mes",val:fmtARS(mInc),color:C.green},{label:"Mant. costo/mes",val:fmtARS(mCost),color:C.red},{label:"Mant. margen/mes",val:fmtARS(mMargin),color:mMargin>=0?C.green:C.red},{label:"Impl. ingreso total",val:fmtARS(totalImplInc),color:C.violet}].map(x=>(<div key={x.label} style={{flex:1,minWidth:120,background:C.white,border:`1px solid ${C.border}`,borderRadius:11,padding:"12px 14px",boxShadow:C.shadow}}><div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:.7,marginBottom:4}}>{x.label}</div><div style={{fontSize:16,fontWeight:800,color:x.color}}>{x.val}</div></div>))}
      </div>
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,padding:"0 20px",overflowX:"auto"}}>
          {[{id:"info",label:"Info básica"},{id:"maint",label:"Mantenimiento"},{id:"projects",label:`Proyectos (${(form.projects||[]).length})`}].map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${C.purple}`:"2px solid transparent",color:tab===t.id?C.purple:C.textSub,padding:"12px 14px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:-1,whiteSpace:"nowrap"}}>{t.label}</button>))}
        </div>
        <div style={{padding:"22px 20px"}}>
          {tab==="info"&&(<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:"0 18px"}}>
              <Fld label="Nombre"><input value={form.name} onChange={e=>u("name",e.target.value)} placeholder="Juan García" style={inp}/></Fld>
              <Fld label="Empresa"><input value={form.company} onChange={e=>u("company",e.target.value)} placeholder="Acme Corp" style={inp}/></Fld>
              <Fld label="Email"><input value={form.email} onChange={e=>u("email",e.target.value)} placeholder="juan@acme.com" style={inp}/></Fld>
              <Fld label="Teléfono"><input value={form.phone} onChange={e=>u("phone",e.target.value)} placeholder="+54 9 11..." style={inp}/></Fld>
            </div>
            <Fld label="Notas"><textarea value={form.notes} onChange={e=>u("notes",e.target.value)} rows={3} placeholder="Observaciones..." style={{...inp,resize:"vertical"}}/></Fld>
            {!isNew&&(<div style={{marginTop:18,paddingTop:18,borderTop:`1px solid ${C.border}`}}>{!confirmDel?(<button onClick={()=>setConfirmDel(true)} style={{background:C.white,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Trash2 size={12}/>Eliminar cliente</button>):(<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontSize:13,color:C.red}}>¿Confirmar?</span><button onClick={onDelete} style={{background:C.red,color:"white",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Eliminar</button><button onClick={()=>setConfirmDel(false)} style={{background:C.white,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer"}}>Cancelar</button></div>)}</div>)}
          </div>)}
          {tab==="maint"&&(<div>
            <div style={{background:"#F0F7FF",border:`1px solid #BFDBFE`,borderRadius:9,padding:"10px 14px",marginBottom:18,fontSize:12,color:C.blue}}>💡 Ingresos y costos recurrentes mensuales.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:"0 18px",marginBottom:18}}>
              <Fld label="Fijo mensual" hint="Retainer"><div style={{position:"relative"}}><span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:C.textMuted,fontSize:12}}>$</span><input type="number" value={form.maintenance.monthlyFixed} onChange={e=>uM("monthlyFixed",e.target.value)} style={{...inp,paddingLeft:22}} min={0}/></div></Fld>
              <Fld label="Variable mensual"><div style={{position:"relative"}}><span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:C.textMuted,fontSize:12}}>$</span><input type="number" value={form.maintenance.monthlyVariable} onChange={e=>uM("monthlyVariable",e.target.value)} style={{...inp,paddingLeft:22}} min={0}/></div></Fld>
            </div>
            <SecHead title="Recursos asignados" action={<button onClick={addRes} style={addBtn}><Plus size={11}/>Agregar</button>}/>
            {(form.maintenance.resources||[]).length===0?(<div style={{textAlign:"center",padding:"18px",color:C.textMuted,fontSize:12,background:"#F8FAFF",borderRadius:9,border:`1px dashed ${C.border}`,marginBottom:14}}>Sin recursos</div>):(<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>{form.maintenance.resources.map(r=>(<div key={r.id} style={{background:"#F8FAFF",border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 14px"}}><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:10,alignItems:"end"}}><Fld label="Tipo"><select value={r.type} onChange={e=>updRes(r.id,"type",e.target.value)} style={inp}>{RESOURCE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></Fld><Fld label="$/hora"><input type="number" value={r.hourlyRate} onChange={e=>updRes(r.id,"hourlyRate",e.target.value)} style={inp} min={0}/></Fld><Fld label="Horas/mes"><input type="number" value={r.hours} onChange={e=>updRes(r.id,"hours",e.target.value)} style={inp} min={0}/></Fld><div style={{paddingBottom:14}}><button onClick={()=>delRes(r.id)} style={delBtn}><Trash2 size={12}/></button></div></div><div style={{fontSize:11,textAlign:"right",color:C.textSub}}>Subtotal: <span style={{color:C.red,fontWeight:700}}>{fmtARS((+r.hourlyRate||0)*(+r.hours||0))}</span></div></div>))}</div>)}
            <SecHead title="Suscripciones" action={<button onClick={addSub} style={addBtn}><Plus size={11}/>Agregar</button>}/>
            {(form.maintenance.subscriptions||[]).length===0?(<div style={{textAlign:"center",padding:"18px",color:C.textMuted,fontSize:12,background:"#F8FAFF",borderRadius:9,border:`1px dashed ${C.border}`,marginBottom:14}}>Sin suscripciones</div>):(<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>{form.maintenance.subscriptions.map(s=>(<div key={s.id} style={{background:"#F8FAFF",border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 14px"}}><div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto auto",gap:10,alignItems:"end"}}><Fld label="Nombre"><input value={s.name} onChange={e=>updSub(s.id,"name",e.target.value)} placeholder="Vercel, AWS..." style={inp}/></Fld><Fld label="$/mes"><input type="number" value={s.cost} onChange={e=>updSub(s.id,"cost",e.target.value)} style={inp} min={0}/></Fld><Fld label="Regular"><div style={{paddingTop:4}}><Toggle value={s.isRegular} onChange={v=>updSub(s.id,"isRegular",v)}/></div></Fld><div style={{paddingBottom:14}}><button onClick={()=>delSub(s.id)} style={delBtn}><Trash2 size={12}/></button></div></div></div>))}</div>)}
            <SummaryBox items={[{label:"Fijo/mes",val:fmtARS(+form.maintenance.monthlyFixed||0),color:C.green},{label:"Variable/mes",val:fmtARS(+form.maintenance.monthlyVariable||0),color:C.green},{label:"Costo recursos/mes",val:fmtARS(mRes),color:C.red},{label:"Costo suscripc./mes",val:fmtARS(mSub),color:C.red},{label:"Margen mensual",val:fmtARS(mMargin),color:mMargin>=0?C.green:C.red,bold:true}]}/>
          </div>)}
          {tab==="projects"&&(<div>
            <div style={{background:"#FFF7ED",border:`1px solid #FED7AA`,borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.amber}}>💡 Proyectos e implementaciones one-shot. No escalan mensualmente.</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{fontSize:13,color:C.textSub}}>{(form.projects||[]).length} proyectos</span><button onClick={addProj} style={addBtn}><Plus size={11}/>Nuevo proyecto</button></div>
            {(form.projects||[]).length===0?(<div style={{textAlign:"center",padding:"32px",color:C.textMuted,fontSize:13,background:"#F8FAFF",borderRadius:9,border:`1px dashed ${C.border}`}}>Sin proyectos</div>)
            :(<div style={{display:"flex",flexDirection:"column",gap:10}}>{form.projects.map(proj=>{
                const exp=expandedProj===proj.id;
                const pInc=(proj.implementations||[]).reduce((s,i)=>s+(+i.income||0),0);
                const pCost=(proj.implementations||[]).reduce((s,i)=>s+implCalc(i).cost,0);
                return (<div key={proj.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:11,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",background:exp?"#F8FAFF":C.white}} onClick={()=>setExpandedProj(exp?null:proj.id)}>
                    <div style={{width:32,height:32,borderRadius:8,background:C.violetBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FolderOpen size={15} color={C.violet}/></div>
                    <div style={{flex:1,minWidth:0}}>{exp?(<input value={proj.name} onChange={e=>updProj(proj.id,"name",e.target.value)} onClick={e=>e.stopPropagation()} style={{...inp,background:"white",width:"100%"}}/>):(<div style={{fontWeight:600,fontSize:13,color:C.text}}>{proj.name||"(sin nombre)"}</div>)}<div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{(proj.implementations||[]).length} impl. · Ing: <span style={{color:C.green,fontWeight:600}}>{fmtARS(pInc)}</span> · Margen: <span style={{color:pInc-pCost>=0?C.green:C.red,fontWeight:600}}>{fmtARS(pInc-pCost)}</span></div></div>
                    <button onClick={e=>{e.stopPropagation();delProj(proj.id)}} style={{...delBtn,marginRight:4}}><Trash2 size={12}/></button>
                    {exp?<ChevronUp size={14} color={C.textMuted}/>:<ChevronDown size={14} color={C.textMuted}/>}
                  </div>
                  {exp&&(<div style={{padding:"0 14px 14px",borderTop:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 10px"}}><span style={{fontSize:12,fontWeight:600,color:C.textSub}}>Implementaciones</span><button onClick={()=>addImpl(proj.id)} style={addBtn}><Plus size={11}/>Agregar</button></div>
                    {(proj.implementations||[]).length===0?(<div style={{textAlign:"center",padding:"18px",color:C.textMuted,fontSize:12,background:"#F8FAFF",borderRadius:9,border:`1px dashed ${C.border}`}}>Sin implementaciones.</div>)
                    :(<div style={{display:"flex",flexDirection:"column",gap:10}}>{proj.implementations.map(impl=>{
                        const ic=implCalc(impl);
                        return (<div key={impl.id} style={{background:"#F8FAFF",border:`1px solid ${C.border}`,borderRadius:10,padding:"14px"}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",marginBottom:12}}><Fld label="Nombre"><input value={impl.name} onChange={e=>updImpl(proj.id,impl.id,"name",e.target.value)} placeholder="Módulo de pagos..." style={inp}/></Fld><div style={{paddingTop:20}}><button onClick={()=>delImpl(proj.id,impl.id)} style={delBtn}><Trash2 size={12}/></button></div></div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
                            <Fld label="Ingreso (ARS)"><div style={{position:"relative"}}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.textMuted,fontSize:12}}>$</span><input type="number" value={impl.income} onChange={e=>updImpl(proj.id,impl.id,"income",e.target.value)} style={{...inp,paddingLeft:20}} min={0}/></div></Fld>
                            <Fld label="Estado"><select value={impl.invoiceStatus} onChange={e=>updImpl(proj.id,impl.id,"invoiceStatus",e.target.value)} style={inp}><option value="pending">Pendiente</option><option value="invoiced">Facturado</option><option value="paid">Pagado</option></select></Fld>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"8px 0 6px"}}><span style={{fontSize:10,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:.5}}>Recursos</span><button onClick={()=>addImplRes(proj.id,impl.id)} style={{...addBtn,fontSize:11,padding:"4px 10px"}}><Plus size={10}/>Recurso</button></div>
                          {(impl.resources||[]).map(r=>(<div key={r.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,alignItems:"end",marginBottom:6}}><Fld label="Tipo"><select value={r.type} onChange={e=>updImplRes(proj.id,impl.id,r.id,"type",e.target.value)} style={inp}>{RESOURCE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></Fld><Fld label="$/hora"><input type="number" value={r.hourlyRate} onChange={e=>updImplRes(proj.id,impl.id,r.id,"hourlyRate",e.target.value)} style={inp} min={0}/></Fld><Fld label="Horas"><input type="number" value={r.hours} onChange={e=>updImplRes(proj.id,impl.id,r.id,"hours",e.target.value)} style={inp} min={0}/></Fld><div style={{paddingBottom:14}}><button onClick={()=>delImplRes(proj.id,impl.id,r.id)} style={delBtn}><Trash2 size={11}/></button></div></div>))}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"6px 0 6px"}}><span style={{fontSize:10,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:.5}}>Otros costos</span><button onClick={()=>addOC(proj.id,impl.id)} style={{...addBtn,fontSize:11,padding:"4px 10px"}}><Plus size={10}/>Costo</button></div>
                          {(impl.otherCosts||[]).map(o=>(<div key={o.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8,alignItems:"end",marginBottom:6}}><Fld label="Descripción"><input value={o.name} onChange={e=>updOC(proj.id,impl.id,o.id,"name",e.target.value)} placeholder="Software..." style={inp}/></Fld><Fld label="Monto ($)"><input type="number" value={o.amount} onChange={e=>updOC(proj.id,impl.id,o.id,"amount",e.target.value)} style={inp} min={0}/></Fld><div style={{paddingBottom:14}}><button onClick={()=>delOC(proj.id,impl.id,o.id)} style={delBtn}><Trash2 size={11}/></button></div></div>))}
                          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>{[{l:"Ingreso",v:fmtARS(ic.income),c:C.green,bg:C.greenBg},{l:"Costo",v:fmtARS(ic.cost),c:C.red,bg:C.redBg},{l:"Margen",v:fmtARS(ic.margin),c:ic.margin>=0?C.green:C.red,bg:ic.margin>=0?C.greenBg:C.redBg}].map(x=>(<div key={x.l} style={{flex:1,minWidth:80,background:x.bg,borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:9,color:x.c,textTransform:"uppercase",fontWeight:700}}>{x.l}</div><div style={{fontSize:12,fontWeight:800,color:x.c,marginTop:1}}>{x.v}</div></div>))}</div>
                        </div>);
                      })}</div>)}
                  </div>)}
                </div>);
              })}</div>)}
          </div>)}
        </div>
      </div>
    </div>
  </div>);
}

// ── Invoice Builder Modal (Mantenimiento) — compact table layout ────────────
function InvoiceBuilderModal({client,month,year,existingInvoice,onSave,onClose,config={}}){
  const dim=new Date(year,month,0).getDate();
  const defaultItems=()=>{const f=+client.maintenance?.monthlyFixed||0;return f>0?[{id:uid(),type:"fixed",label:"Mantenimiento fijo",qty:1,unitPrice:f,daysInMonth:dim}]:[];};
  const[items,setItems]=useState(()=>existingInvoice?.lineItems?.length?existingInvoice.lineItems.map(i=>({...i,daysInMonth:dim})):defaultItems());
  const[status,setStatus]=useState(existingInvoice?.status||"pending");
  // CSV import state
  const[csvParsed,setCsvParsed]=useState(null);const[csvError,setCsvError]=useState("");
  const[colCid,setColCid]=useState("");const[colEmail,setColEmail]=useState("");const[colJoined,setColJoined]=useState("");const[colLeft,setColLeft]=useState("");
  const[selCVal,setSelCVal]=useState("");const[importPrice,setImportPrice]=useState(0);const[importMode,setImportMode]=useState("individual");

  const handleCSVFile=e=>{
    const file=e.target.files?.[0];if(!file)return;setCsvError("");
    const reader=new FileReader();
    reader.onload=ev=>{
      const{headers,rows}=parseCSV(ev.target.result);
      if(!headers.length){setCsvError("CSV inválido.");return;}
      const cid=guessClientIdCol(headers),em=guessEmailCol(headers)||"",j=guessJoinedCol(headers)||"",l=guessLeftCol(headers)||"";
      setColCid(cid);setColEmail(em);setColJoined(j);setColLeft(l);
      const uids=[...new Set(rows.map(r=>r[cid]).filter(Boolean))];
      const auto=uids.find(v=>v.toLowerCase()===client.id.toLowerCase()||(client.company&&v.toLowerCase()===client.company.toLowerCase())||(client.name&&v.toLowerCase()===client.name.toLowerCase()))||uids[0]||"";
      setSelCVal(auto);setCsvParsed({headers,rows,uids});
    };
    reader.readAsText(file,"utf-8");e.target.value="";
  };
  const csvUsers=csvParsed&&selCVal&&colCid?csvParsed.rows.filter(r=>r[colCid]===selCVal).map(r=>({email:colEmail?r[colEmail]:"—",joined:colJoined?r[colJoined]:"",left:colLeft?r[colLeft]:"",days:calcDaysActiveInMonth(colJoined?r[colJoined]:"",colLeft?r[colLeft]:"",year,month)})).filter(u=>u.days>0):[];

  const addCSVItems=()=>{
    const price=+importPrice||0;let ni=[];
    if(importMode==="grouped"){
      const full=csvUsers.filter(u=>u.days>=dim),partial=csvUsers.filter(u=>u.days<dim);
      if(full.length)ni.push({id:uid(),type:"extra_users",label:`Usuarios mes completo (${full.length})`,qty:full.length,unitPrice:price,prorated:false,daysInMonth:dim});
      partial.forEach(u=>ni.push({id:uid(),type:"extra_users",label:`Proporcional — ${u.email}`,qty:1,unitPrice:price,prorated:true,daysActive:u.days,daysInMonth:dim}));
    }else{
      csvUsers.forEach(u=>{const full=u.days>=dim;ni.push({id:uid(),type:"extra_users",label:`Usuario — ${u.email}`,qty:1,unitPrice:price,prorated:!full,daysActive:u.days,daysInMonth:dim});});
    }
    setItems(p=>[...p,...ni]);setCsvParsed(null);
  };

  const updItem=(id,k,v)=>setItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const delItem=id=>setItems(p=>p.filter(i=>i.id!==id));
  const addItem=type=>{
    const defs={fixed:{label:"Mantenimiento fijo",qty:1,unitPrice:+client.maintenance?.monthlyFixed||0},support_hours:{label:"Horas de soporte",qty:0,unitPrice:0},extra_users:{label:"Usuario extra",qty:1,unitPrice:0,prorated:false}};
    setItems(p=>[...p,{id:uid(),type,daysInMonth:dim,...defs[type]}]);
  };
  const total=items.reduce((s,i)=>s+calcItemAmount(i),0);
  const buildInvoice=()=>({id:existingInvoice?.id||uid(),month,year,lineItems:items,total,status,createdAt:existingInvoice?.createdAt||new Date().toISOString()});
  const handleSave=()=>onSave(buildInvoice());
  const handleExport=()=>{const inv={...buildInvoice(),status:status==="pending"?"invoiced":status};onSave(inv);printInvoice({invoiceId:`MT-${client.id.slice(0,4).toUpperCase()}-${year}${String(month).padStart(2,"0")}`,type:"maintenance",client,amount:total,period:`${MONTHS[month-1]} ${year}`,lineItems:items,config});};

  const rInp={...sinp,width:"100%"};
  const numInp=(w)=>({...sinp,width:w,textAlign:"right"});

  return(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:C.white,borderRadius:16,boxShadow:"0 24px 60px rgba(0,0,0,0.18)",width:"100%",maxWidth:820,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>Armar factura</div><div style={{fontSize:12,color:C.textSub,marginTop:1}}><strong>{client.name}</strong>{client.company?` · ${client.company}`:""} — {MONTHS[month-1]} {year} ({dim} días)</div></div>
        <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.textSub,fontWeight:600,fontSize:14}}>✕</button>
      </div>
      {/* Toolbar */}
      <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",background:"#FAFBFF",flexShrink:0}}>
        <span style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginRight:2}}>+ Agregar:</span>
        {Object.entries(TYPE_META).map(([type,meta])=>(<button key={type} onClick={()=>addItem(type)} style={{background:meta.bg,color:meta.color,border:`1px solid ${meta.color}44`,borderRadius:7,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{meta.badge}</button>))}
        <div style={{marginLeft:"auto"}}>
          <label style={{background:"#1E293B",color:"white",border:"none",borderRadius:7,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <FileText size={11}/>Importar CSV
            <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={handleCSVFile}/>
          </label>
        </div>
      </div>

      {/* CSV Panel */}
      {csvParsed&&(
        <div style={{background:"#F8FAFF",borderBottom:`1px solid ${C.border}`,padding:"14px 24px",flexShrink:0,overflowY:"auto",maxHeight:340}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:C.text}}>📂 Importar usuarios</div><button onClick={()=>setCsvParsed(null)} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:16}}>✕</button></div>
          {csvError&&<div style={{background:C.redBg,color:C.red,borderRadius:7,padding:"7px 12px",fontSize:12,marginBottom:10}}>{csvError}</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:"0 12px",marginBottom:12}}>
            {[{l:"Col. cliente",v:colCid,s:setColCid},{l:"Col. email",v:colEmail,s:setColEmail},{l:"Col. alta",v:colJoined,s:setColJoined},{l:"Col. baja",v:colLeft,s:setColLeft}].map(f=>(<div key={f.l} style={{marginBottom:8}}><label style={{display:"block",fontSize:9,color:C.textSub,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{f.l}</label><select value={f.v} onChange={e=>f.s(e.target.value)} style={{...sinp}}><option value="">(ninguna)</option>{csvParsed.headers.map(h=><option key={h} value={h}>{h}</option>)}</select></div>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:12}}>
            <div><label style={{display:"block",fontSize:9,color:C.textSub,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Cliente en CSV</label><select value={selCVal} onChange={e=>setSelCVal(e.target.value)} style={sinp}><option value="">— seleccionar —</option>{csvParsed.uids.map(v=><option key={v} value={v}>{v}</option>)}</select><div style={{fontSize:10,color:C.textMuted,marginTop:2}}>ID: <code style={{background:"#EEF0FA",padding:"0 4px",borderRadius:3}}>{client.id}</code></div></div>
            <div><label style={{display:"block",fontSize:9,color:C.textSub,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Precio / usuario / mes</label><div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.textMuted,fontSize:11}}>$</span><input type="number" value={importPrice} onChange={e=>setImportPrice(e.target.value)} style={{...sinp,paddingLeft:18}} min={0}/></div></div>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:12}}>{[{id:"individual",l:"Por usuario"},{id:"grouped",l:"Agrupado"}].map(m=>(<button key={m.id} onClick={()=>setImportMode(m.id)} style={{padding:"4px 10px",fontSize:11,border:`1px solid ${importMode===m.id?C.purple:C.border}`,background:importMode===m.id?C.purpleLight:C.white,color:importMode===m.id?C.purple:C.textSub,borderRadius:6,cursor:"pointer"}}>{m.l}</button>))}</div>
          {selCVal&&csvUsers.length>0&&(
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden",marginBottom:10}}>
              <div style={{padding:"7px 14px",background:"#F0F3FA",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:700,color:C.text}}>{csvUsers.length} usuarios · {MONTHS[month-1]} {year}</span></div>
              <div style={{overflowY:"auto",maxHeight:130}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Email","Alta","Baja","Días","Tipo"].map(h=>(<th key={h} style={{padding:"5px 10px",textAlign:"left",color:C.textMuted,fontWeight:500,fontSize:10,borderBottom:`1px solid ${C.border}`}}>{h}</th>))}</tr></thead><tbody>{csvUsers.map((u,i)=>(<tr key={i} style={{borderBottom:i<csvUsers.length-1?`1px solid ${C.border}`:"none",background:u.days<dim?"#FFFBEB":C.white}}><td style={{padding:"5px 10px",fontSize:11}}>{u.email}</td><td style={{padding:"5px 10px",fontSize:11,color:C.textSub}}>{u.joined||"—"}</td><td style={{padding:"5px 10px",fontSize:11,color:C.textSub}}>{u.left||"activo"}</td><td style={{padding:"5px 10px",fontSize:11,fontWeight:700,color:u.days>=dim?C.green:C.amber}}>{u.days}/{dim}</td><td style={{padding:"5px 10px"}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,fontWeight:600,background:u.days>=dim?C.greenBg:C.amberBg,color:u.days>=dim?C.green:C.amber}}>{u.days>=dim?"Completo":"Proporcional"}</span></td></tr>))}</tbody></table></div>
            </div>
          )}
          {selCVal&&csvUsers.length===0&&<div style={{background:C.amberBg,color:C.amber,borderRadius:7,padding:"7px 12px",fontSize:12,marginBottom:10}}>Sin usuarios activos en {MONTHS[month-1]} {year} para "{selCVal}".</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>setCsvParsed(null)} style={{background:C.white,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:7,padding:"6px 14px",fontSize:12,cursor:"pointer"}}>Cancelar</button>
            <button onClick={addCSVItems} disabled={!csvUsers.length} style={{background:csvUsers.length?C.purple:"#C4C4C4",color:"white",border:"none",borderRadius:7,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:csvUsers.length?"pointer":"default"}}>Agregar {csvUsers.length} usuario{csvUsers.length!==1?"s":""} →</button>
          </div>
        </div>
      )}

      {/* Items — compact table */}
      <div style={{flex:1,overflowY:"auto",padding:"0"}}>
        {items.length===0?(
          <div style={{textAlign:"center",padding:"44px 20px",color:C.textMuted,fontSize:13}}>
            <div style={{fontSize:32,marginBottom:10}}>🧾</div>
            Usá los botones de arriba para agregar ítems o importar un CSV.<br/>
            <span style={{fontSize:11,display:"block",marginTop:6}}>El mant. fijo del contrato se pre-carga automáticamente.</span>
          </div>
        ):(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead style={{position:"sticky",top:0,background:"#F8FAFF",zIndex:1}}>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                <th style={{padding:"8px 10px 8px 20px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,width:110}}>Tipo</th>
                <th style={{padding:"8px 6px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>Descripción</th>
                <th style={{padding:"8px 6px",textAlign:"right",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,width:70}}>Cant.</th>
                <th style={{padding:"8px 6px",textAlign:"right",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,width:120}}>$ / u</th>
                <th style={{padding:"8px 6px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,width:40}} title="Proporcional">∝</th>
                <th style={{padding:"8px 6px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,width:110}}>Días</th>
                <th style={{padding:"8px 6px",textAlign:"right",fontSize:10,color:C.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,width:100}}>Subtotal</th>
                <th style={{width:36}}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item,idx)=>{
                const meta=TYPE_META[item.type]||TYPE_META.fixed;
                const amt=calcItemAmount(item);
                const isUsers=item.type==="extra_users";
                const isProrated=isUsers&&item.prorated;
                return(
                  <tr key={item.id} style={{borderBottom:idx<items.length-1?`1px solid ${C.border}`:"none",background:idx%2===0?C.white:"#FAFBFF"}}>
                    <td style={{padding:"8px 10px 8px 20px",verticalAlign:"middle"}}>
                      <span style={{background:meta.bg,color:meta.color,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5,whiteSpace:"nowrap"}}>{meta.badge}</span>
                    </td>
                    <td style={{padding:"6px 6px",verticalAlign:"middle"}}>
                      <input value={item.label} onChange={e=>updItem(item.id,"label",e.target.value)} style={{...rInp}} placeholder="Descripción"/>
                    </td>
                    <td style={{padding:"6px 6px",verticalAlign:"middle"}}>
                      <input type="number" value={item.qty} onChange={e=>updItem(item.id,"qty",e.target.value)} style={numInp(60)} min={0}/>
                    </td>
                    <td style={{padding:"6px 6px",verticalAlign:"middle"}}>
                      <div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:C.textMuted,fontSize:11}}>$</span><input type="number" value={item.unitPrice} onChange={e=>updItem(item.id,"unitPrice",e.target.value)} style={{...numInp(110),paddingLeft:18}} min={0}/></div>
                    </td>
                    <td style={{padding:"6px 6px",verticalAlign:"middle",textAlign:"center"}}>
                      {isUsers?(
                        <button onClick={()=>updItem(item.id,"prorated",!item.prorated)} title={isProrated?"Quitar proporcional":"Hacer proporcional"} style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${isProrated?C.amber:C.border}`,background:isProrated?C.amberBg:C.white,color:isProrated?C.amber:C.textMuted,cursor:"pointer",fontSize:14,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          ∝
                        </button>
                      ):<span style={{color:C.border}}>—</span>}
                    </td>
                    <td style={{padding:"6px 6px",verticalAlign:"middle"}}>
                      {isProrated?(
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <input type="number" value={item.daysActive||0} onChange={e=>updItem(item.id,"daysActive",e.target.value)} style={{...numInp(48)}} min={0} max={dim}/>
                          <span style={{fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>/ {dim}</span>
                        </div>
                      ):<span style={{color:C.border,fontSize:11,display:"block",textAlign:"center"}}>—</span>}
                    </td>
                    <td style={{padding:"6px 6px",verticalAlign:"middle",textAlign:"right",fontWeight:700,fontSize:13,color:amt>0?C.green:C.textMuted,whiteSpace:"nowrap"}}>
                      {fmtARS(amt)}
                    </td>
                    <td style={{padding:"6px 10px 6px 4px",verticalAlign:"middle"}}>
                      <button onClick={()=>delItem(item.id)} style={{width:24,height:24,borderRadius:5,border:`1px solid ${C.border}`,background:C.white,color:C.red,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,flexShrink:0,background:C.white}}>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div><div style={{fontSize:10,color:C.textSub,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Total</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>{fmtARS(total)}</div></div>
          <div>
            <div style={{fontSize:10,color:C.textSub,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Estado</div>
            <StatusPicker value={status} onChange={setStatus}/>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{background:C.white,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:9,padding:"9px 18px",fontSize:13,cursor:"pointer"}}>Cancelar</button>
          <button onClick={handleSave} style={{background:"#F3F4F6",border:`1px solid ${C.border}`,color:C.text,borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Guardar</button>
          <button onClick={handleExport} style={{background:C.purple,color:"white",border:"none",borderRadius:9,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}><Printer size={14}/>Exportar PDF</button>
        </div>
      </div>
    </div>
  </div>
);}

// ── Impl Invoice Modal (factura libre de implementación) ──────────────────────
function ImplInvoiceModal({clients,existingInvoice,onSave,onClose,config={}}){
  const[selClientId,setSelClientId]=useState(existingInvoice?.clientId||"");
  const[selProjId,setSelProjId]=useState(existingInvoice?.projectId||"");
  const[selImplId,setSelImplId]=useState(existingInvoice?.implId||"");
  const[servicio,setServicio]=useState(existingInvoice?.servicio||"Implementación de software");
  const[descripcion,setDescripcion]=useState(existingInvoice?.descripcion||"");
  const[monto,setMonto]=useState(existingInvoice?.monto||0);
  const[fecha,setFecha]=useState(existingInvoice?.fecha||today());
  const[status,setStatus]=useState(existingInvoice?.status||"pending");

  const selClient=clients.find(c=>c.id===selClientId)||null;
  const availableProjs=selClient?.projects||[];
  const selProj=availableProjs.find(p=>p.id===selProjId)||null;
  const availableImpls=selProj?.implementations||[];

  const handleImplSelect=iid=>{
    setSelImplId(iid);
    if(iid){const impl=availableImpls.find(i=>i.id===iid);if(impl){if(!monto||+monto===0)setMonto(+impl.income||0);if(!servicio||servicio==="Implementación de software")setServicio(impl.name||servicio);}}
  };

  const total=+monto||0;
  const invoiceId=existingInvoice?.id||uid();
  const invNum=`IMPL-${invoiceId.slice(0,6).toUpperCase()}`;

  const buildInvoice=()=>({id:invoiceId,clientId:selClientId,projectId:selProjId,implId:selImplId,servicio,descripcion,monto:total,fecha,status,createdAt:existingInvoice?.createdAt||new Date().toISOString()});
  const handleSave=()=>{if(!selClientId)return;onSave(buildInvoice());};
  const handleExport=()=>{
    if(!selClient)return;
    const inv={...buildInvoice(),status:status==="pending"?"invoiced":status};
    onSave(inv);
    printInvoice({invoiceId:invNum,type:"implementation",client:selClient,amount:total,period:null,detail:servicio,config,customFields:{descripcion,fecha}});
  };

  const S={...sinp};
  return(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:C.white,borderRadius:16,boxShadow:"0 24px 60px rgba(0,0,0,0.18)",width:"100%",maxWidth:640,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>Nueva factura de implementación</div><div style={{fontSize:11,color:C.textSub,marginTop:1}}>Factura one-shot independiente</div></div>
        <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.textSub,fontWeight:600,fontSize:14}}>✕</button>
      </div>
      <div style={{padding:"20px 24px",overflowY:"auto"}}>
        {/* Client + project + impl selectors */}
        <div style={{background:"#F8FAFF",border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:18}}>
          <div style={{fontSize:11,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Referencia</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Fld label="Cliente *"><select value={selClientId} onChange={e=>{setSelClientId(e.target.value);setSelProjId("");setSelImplId("");}} style={S}><option value="">— seleccionar —</option>{clients.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}{c.company?` (${c.company})`:""}</option>)}</select></Fld>
            <Fld label="Proyecto (opcional)"><select value={selProjId} onChange={e=>{setSelProjId(e.target.value);setSelImplId("");}} style={S} disabled={!selClientId}><option value="">— ninguno —</option>{availableProjs.map(p=><option key={p.id} value={p.id}>{p.name||"(sin nombre)"}</option>)}</select></Fld>
            {selProjId&&(<Fld label="Implementación de referencia" col="1 / span 2"><select value={selImplId} onChange={e=>handleImplSelect(e.target.value)} style={S}><option value="">— ninguna —</option>{availableImpls.map(i=><option key={i.id} value={i.id}>{i.name||"(sin nombre)"} — {fmtARS(+i.income||0)}</option>)}</select></Fld>)}
          </div>
        </div>
        {/* Editable fields */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
          <Fld label="Servicio / Concepto" col="1 / span 2"><input value={servicio} onChange={e=>setServicio(e.target.value)} style={inp} placeholder="Desarrollo de módulo de pagos..."/></Fld>
          <Fld label="Monto (ARS) *"><div style={{position:"relative"}}><span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:C.textMuted,fontSize:12}}>$</span><input type="number" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp,paddingLeft:22}} min={0}/></div></Fld>
          <Fld label="Fecha de factura"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></Fld>
          <Fld label="Descripción / Detalle" col="1 / span 2"><textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={3} placeholder="Descripción detallada del trabajo realizado..." style={{...inp,resize:"vertical"}}/></Fld>
        </div>
        {/* Preview pill */}
        <div style={{background:"#F0F3FA",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:.5}}>N° Factura</div><div style={{fontSize:12,fontWeight:700,color:C.text,marginTop:2}}>{invNum}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:.5}}>Total</div><div style={{fontSize:20,fontWeight:800,color:C.violet,marginTop:2}}>{fmtARS(total)}</div></div>
        </div>
      </div>
      <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><div style={{fontSize:10,color:C.textSub,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Estado</div><StatusPicker value={status} onChange={setStatus}/></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{background:C.white,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:9,padding:"9px 18px",fontSize:13,cursor:"pointer"}}>Cancelar</button>
          <button onClick={handleSave} disabled={!selClientId} style={{background:selClientId?"#F3F4F6":"#E5E7EB",border:`1px solid ${C.border}`,color:selClientId?C.text:C.textMuted,borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:selClientId?"pointer":"default"}}>Guardar</button>
          <button onClick={handleExport} disabled={!selClientId||!total} style={{background:selClientId&&total?C.purple:"#C4C4C4",color:"white",border:"none",borderRadius:9,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:selClientId&&total?"pointer":"default",display:"flex",alignItems:"center",gap:7}}><Printer size={14}/>Exportar PDF</button>
        </div>
      </div>
    </div>
  </div>
);}

// ── Facturación View ───────────────────────────────────────────────────────────
function FacturacionView({clients,onUpdateClient,config}){
  const[tab,setTab]=useState("maint");
  const now=new Date();const[selMonth,setSelMonth]=useState(now.getMonth()+1);const[selYear,setSelYear]=useState(now.getFullYear());
  const[builderClient,setBuilderClient]=useState(null);
  const[implModal,setImplModal]=useState(null); // null | { clientId, invoice }

  const prevMonth=()=>{if(selMonth===1){setSelMonth(12);setSelYear(y=>y-1);}else setSelMonth(m=>m-1);};
  const nextMonth=()=>{if(selMonth===12){setSelMonth(1);setSelYear(y=>y+1);}else setSelMonth(m=>m+1);};
  const getMaintInv=c=>(c.maintenanceInvoices||[]).find(inv=>inv.month===selMonth&&inv.year===selYear);

  const handleMaintSave=(invoice)=>{
    const client=builderClient;const has=!!getMaintInv(client);
    onUpdateClient({...client,maintenanceInvoices:has?client.maintenanceInvoices.map(i=>i.month===selMonth&&i.year===selYear?invoice:i):[...(client.maintenanceInvoices||[]),invoice]});
    setBuilderClient(null);
  };

  const handleImplSave=(invoice)=>{
    const client=clients.find(c=>c.id===invoice.clientId);if(!client)return;
    const existing=(client.implInvoices||[]).find(i=>i.id===invoice.id);
    onUpdateClient({...client,implInvoices:existing?(client.implInvoices||[]).map(i=>i.id===invoice.id?invoice:i):[...(client.implInvoices||[]),invoice]});
    setImplModal(null);
  };

  const allImplInvoices=clients.flatMap(c=>(c.implInvoices||[]).map(inv=>({...inv,_client:c})));
  const activeWithMaint=clients.filter(c=>c.active&&maintIncome(c)>0);
  const AB=({onClick,color,bg,children,disabled})=>(<button onClick={onClick} disabled={disabled} style={{background:disabled?"#F3F4F6":bg,color:disabled?C.textMuted:color,border:`1px solid ${disabled?C.border:color}`,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:disabled?"default":"pointer",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",opacity:disabled?.6:1}}>{children}</button>);

  return (<div style={{padding:"26px"}}>
    {builderClient&&<InvoiceBuilderModal client={builderClient} month={selMonth} year={selYear} existingInvoice={getMaintInv(builderClient)||null} onSave={handleMaintSave} onClose={()=>setBuilderClient(null)} config={config}/>}
    {implModal!==null&&<ImplInvoiceModal clients={clients} existingInvoice={implModal||null} onSave={handleImplSave} onClose={()=>setImplModal(null)} config={config}/>}

    <div style={{marginBottom:22}}><h1 style={{fontSize:19,fontWeight:700,color:C.text}}>Facturación</h1><div style={{fontSize:11,color:C.textSub,marginTop:3}}>Armá, exportá y gestioná tus facturas</div></div>
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,overflow:"hidden"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,padding:"0 20px"}}>{[{id:"maint",l:"Mantenimiento"},{id:"impl",l:"Implementaciones"}].map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${C.purple}`:"2px solid transparent",color:tab===t.id?C.purple:C.textSub,padding:"13px 14px",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:-1}}>{t.l}</button>))}</div>

      {tab==="maint"&&(<div>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <button onClick={prevMonth} style={{background:"#F3F4F6",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:C.textSub,display:"flex",alignItems:"center"}}><ChevronRight size={14} style={{transform:"rotate(180deg)"}}/></button>
          <span style={{fontSize:14,fontWeight:700,color:C.text,minWidth:180,textAlign:"center"}}>{MONTHS[selMonth-1]} {selYear}</span>
          <button onClick={nextMonth} style={{background:"#F3F4F6",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:C.textSub,display:"flex",alignItems:"center"}}><ChevronRight size={14}/></button>
          <span style={{fontSize:11,color:C.textMuted}}>— {activeWithMaint.length} clientes activos</span>
        </div>
        {activeWithMaint.length===0?(<div style={{padding:"52px",textAlign:"center",color:C.textMuted,fontSize:13}}>Sin clientes activos con mantenimiento</div>):(
          <><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
            <thead><tr>{["Cliente","Empresa","Monto","Estado","Acción"].map(h=>(<th key={h} style={{padding:"10px 18px",textAlign:"left",color:C.textMuted,fontWeight:500,fontSize:11,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
            <tbody>{activeWithMaint.map((c,i)=>{
              const inv=getMaintInv(c);const status=inv?inv.status:"pending";const amt=inv?.total??maintIncome(c);const hasItems=(inv?.lineItems?.length||0)>0;
              return (<tr key={c.id} style={{borderBottom:i<activeWithMaint.length-1?`1px solid ${C.border}`:"none"}}>
                <td style={{padding:"13px 18px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:30,height:30,borderRadius:"50%",background:C.purpleLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.purple,flexShrink:0}}>{(c.name||"?").charAt(0).toUpperCase()}</div><span style={{fontWeight:600,fontSize:13,color:C.text}}>{c.name||"(sin nombre)"}</span></div></td>
                <td style={{padding:"13px 18px",fontSize:13,color:C.textSub}}>{c.company||"—"}</td>
                <td style={{padding:"13px 18px"}}><div style={{fontSize:13,fontWeight:700,color:C.green}}>{fmtARS(amt)}</div><div style={{fontSize:10,color:C.textMuted,marginTop:1}}>{hasItems?`${inv.lineItems.length} ítems`:"base contrato"}</div></td>
                <td style={{padding:"13px 18px"}}><InvBadge status={status}/></td>
                <td style={{padding:"13px 18px"}}><AB onClick={()=>setBuilderClient(c)} color={C.purple} bg={C.purpleLight}><FileText size={11}/>{inv?"Editar factura":"Armar factura"}</AB></td>
              </tr>);
            })}</tbody>
          </table></div>
          <div style={{padding:"13px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:24,flexWrap:"wrap"}}>
            {[{l:"Total del mes",v:fmtARS(activeWithMaint.reduce((s,c)=>{const inv=getMaintInv(c);return s+(inv?.total??maintIncome(c));},0)),c:C.green},{l:"Pagado",v:fmtARS(activeWithMaint.filter(c=>getMaintInv(c)?.status==="paid").reduce((s,c)=>s+(getMaintInv(c)?.total??maintIncome(c)),0)),c:C.green},{l:"Pendiente",v:fmtARS(activeWithMaint.filter(c=>getMaintInv(c)?.status!=="paid").reduce((s,c)=>{const inv=getMaintInv(c);return s+(inv?.total??maintIncome(c));},0)),c:C.amber}].map(x=>(<div key={x.l} style={{fontSize:12,color:C.textSub}}>{x.l}: <span style={{fontWeight:700,color:x.c}}>{x.v}</span></div>))}
          </div></>
        )}
      </div>)}

      {tab==="impl"&&(<div>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:C.textSub}}>{allImplInvoices.length} factura{allImplInvoices.length!==1?"s":""} de implementación</span>
          <button onClick={()=>setImplModal({})} style={{background:C.purple,color:"white",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Plus size={12}/>Nueva factura</button>
        </div>
        {allImplInvoices.length===0?(<div style={{padding:"52px",textAlign:"center",color:C.textMuted,fontSize:13}}>Sin facturas de implementación. Creá la primera con el botón de arriba.</div>):(
          <><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead><tr>{["Cliente","Concepto","Fecha","Monto","Estado","Acción"].map(h=>(<th key={h} style={{padding:"10px 18px",textAlign:"left",color:C.textMuted,fontWeight:500,fontSize:11,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
            <tbody>{allImplInvoices.map((inv,i)=>(<tr key={inv.id} style={{borderBottom:i<allImplInvoices.length-1?`1px solid ${C.border}`:"none"}}>
              <td style={{padding:"13px 18px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:"50%",background:C.purpleLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.purple,flexShrink:0}}>{(inv._client?.name||"?").charAt(0).toUpperCase()}</div><span style={{fontSize:13,fontWeight:600,color:C.text}}>{inv._client?.name||"—"}</span></div></td>
              <td style={{padding:"13px 18px",fontSize:13,color:C.text}}>{inv.servicio||"—"}</td>
              <td style={{padding:"13px 18px",fontSize:12,color:C.textSub}}>{inv.fecha||"—"}</td>
              <td style={{padding:"13px 18px",fontSize:13,fontWeight:700,color:C.violet}}>{fmtARS(+inv.monto||0)}</td>
              <td style={{padding:"13px 18px"}}><InvBadge status={inv.status||"pending"}/></td>
              <td style={{padding:"13px 18px"}}><AB onClick={()=>setImplModal(inv)} color={C.purple} bg={C.purpleLight}><FileText size={11}/>Editar / PDF</AB></td>
            </tr>))}</tbody>
          </table></div>
          <div style={{padding:"13px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:24,flexWrap:"wrap"}}>
            {[{l:"Total",v:fmtARS(allImplInvoices.reduce((s,i)=>s+(+i.monto||0),0)),c:C.violet},{l:"Pagado",v:fmtARS(allImplInvoices.filter(i=>i.status==="paid").reduce((s,i)=>s+(+i.monto||0),0)),c:C.green},{l:"Pendiente",v:fmtARS(allImplInvoices.filter(i=>i.status!=="paid").reduce((s,i)=>s+(+i.monto||0),0)),c:C.amber}].map(x=>(<div key={x.l} style={{fontSize:12,color:C.textSub}}>{x.l}: <span style={{fontWeight:700,color:x.c}}>{x.v}</span></div>))}
          </div></>
        )}
      </div>)}
    </div>
  </div>);
}

// ── Configuración View ─────────────────────────────────────────────────────────
function ConfiguracionView({config,onSave}){
  const[form,setForm]=useState({...blankConfig(),...config,company:{...blankConfig().company,...config.company},invoice:{...blankConfig().invoice,...config.invoice}});
  const[saved,setSaved]=useState(false);
  const uC=(k,v)=>setForm(p=>({...p,company:{...p.company,[k]:v}}));
  const uI=(k,v)=>setForm(p=>({...p,invoice:{...p.invoice,[k]:v}}));
  const handleLogoUpload=e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=ev=>uC("logo",ev.target.result);r.readAsDataURL(file);};
  const handleSave=()=>{onSave(form);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const INV_OPTS=[
    {k:"showLogo",           l:"Logo de empresa"},
    {k:"showCompanyName",    l:"Nombre de empresa"},
    {k:"showEmail",          l:"Email de contacto"},
    {k:"showInvoiceNumber",  l:"N° de factura"},
    {k:"showDate",           l:"Fecha de emisión"},
    {k:"showPeriod",         l:"Período (mantenimiento)"},
    {k:"showItemType",       l:"Badge de tipo (Mant./Impl.)"},
    {k:"showItemDetail",     l:"Columna de detalle/cantidad"},
    {k:"showTotal",          l:"Total destacado"},
    {k:"showFooter",         l:"Pie de página"},
  ];
  return (<div style={{padding:"26px",maxWidth:700}}>
    <div style={{marginBottom:22}}><h1 style={{fontSize:19,fontWeight:700,color:C.text}}>Configuración</h1><div style={{fontSize:11,color:C.textSub,marginTop:3}}>Perfil de empresa y modelo de factura</div></div>

    {/* Perfil */}
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,overflow:"hidden",marginBottom:18}}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}><Building2 size={15} color={C.purple}/><span style={{fontSize:13,fontWeight:700,color:C.text}}>Perfil de empresa</span></div>
      <div style={{padding:"20px"}}>
        {/* Logo upload */}
        <div style={{display:"flex",alignItems:"flex-start",gap:20,marginBottom:20}}>
          <div style={{flexShrink:0}}>
            <div style={{width:72,height:72,borderRadius:14,background:C.purpleLight,border:`2px dashed ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
              {form.company.logo?(<img src={form.company.logo} style={{width:"100%",height:"100%",objectFit:"contain"}} alt="logo"/>):(<Building2 size={28} color={C.textMuted}/>)}
            </div>
            <label style={{display:"block",marginTop:8,fontSize:11,fontWeight:600,color:C.purple,cursor:"pointer",textAlign:"center"}}>
              <Upload size={11}/> Subir logo
              <input type="file" accept="image/*" style={{display:"none"}} onChange={handleLogoUpload}/>
            </label>
            {form.company.logo&&<button onClick={()=>uC("logo","")} style={{display:"block",margin:"4px auto 0",fontSize:10,color:C.red,background:"none",border:"none",cursor:"pointer"}}>Quitar</button>}
          </div>
          <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Fld label="Nombre empresa"><input value={form.company.name} onChange={e=>uC("name",e.target.value)} style={inp} placeholder="Mi Empresa SRL"/></Fld>
            <Fld label="Email de facturación"><input value={form.company.email} onChange={e=>uC("email",e.target.value)} style={inp} placeholder="facturacion@empresa.com"/></Fld>
            <Fld label="Teléfono"><input value={form.company.phone} onChange={e=>uC("phone",e.target.value)} style={inp} placeholder="+54 11 xxxx-xxxx"/></Fld>
            <Fld label="CUIT"><input value={form.company.cuit} onChange={e=>uC("cuit",e.target.value)} style={inp} placeholder="20-12345678-9"/></Fld>
          </div>
        </div>
        <Fld label="Dirección"><input value={form.company.address} onChange={e=>uC("address",e.target.value)} style={inp} placeholder="Av. Corrientes 1234, CABA"/></Fld>
      </div>
    </div>

    {/* Modelo de factura */}
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,overflow:"hidden",marginBottom:18}}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}><FileText size={15} color={C.purple}/><span style={{fontSize:13,fontWeight:700,color:C.text}}>Modelo de factura PDF</span></div>
      <div style={{padding:"20px"}}>
        <div style={{fontSize:12,color:C.textSub,marginBottom:14}}>Activá o desactivá los campos que quierés que aparezcan en el PDF exportado.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {INV_OPTS.map(o=>(<div key={o.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#F8FAFF",borderRadius:9,border:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.text}}>{o.l}</span><Toggle value={form.invoice[o.k]} onChange={v=>uI(o.k,v)}/></div>))}
        </div>
      </div>
    </div>

    <div style={{display:"flex",justifyContent:"flex-end"}}>
      <button onClick={handleSave} style={{background:saved?C.green:C.purple,color:"white",border:"none",borderRadius:9,padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer",transition:"background .3s"}}>{saved?"✓ Guardado":"Guardar cambios"}</button>
    </div>
  </div>);
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App(){
  const[clients,setClients]=useState([]);
  const[view,setView]=useState("dashboard");
  const[editId,setEditId]=useState(null);
  const[loaded,setLoaded]=useState(false);
  const[config,setConfig]=useState(blankConfig());

  useEffect(()=>{
    (async()=>{
      try{const r=await window.storage.get("admindash_v2");if(r?.value)setClients(JSON.parse(r.value));}catch{}
      try{const r=await window.storage.get("admindash_config_v1");if(r?.value)setConfig(prev=>({...prev,...JSON.parse(r.value)}));}catch{}
      setLoaded(true);
    })();
  },[]);
  useEffect(()=>{if(!loaded)return;window.storage.set("admindash_v2",JSON.stringify(clients)).catch(()=>{});},[clients,loaded]);
  const saveConfig=cfg=>{setConfig(cfg);window.storage.set("admindash_config_v1",JSON.stringify(cfg)).catch(()=>{});};

  const nav=(v,id=null)=>{setView(v);if(v==="client-form")setEditId(id);};
  const saveClient=data=>{if(!editId)setClients(p=>[...p,{...blankClient(),...data}]);else setClients(p=>p.map(c=>c.id===editId?{...c,...data}:c));nav("clients");};
  const deleteClient=()=>{setClients(p=>p.filter(c=>c.id!==editId));nav("clients");};
  const updateClient=updated=>setClients(p=>p.map(c=>c.id===updated.id?updated:c));
  const editingClient=editId?(clients.find(c=>c.id===editId)||blankClient()):blankClient();

  if(!loaded)return <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMuted,fontFamily:"system-ui"}}>Cargando...</div>;

  const viewLabel={dashboard:"Bienvenido 👋",clients:"Clientes",billing:"Facturación",settings:"Configuración"};
  return(
    <div style={{fontFamily:"system-ui,-apple-system,sans-serif",background:C.bg,color:C.text,minHeight:"100vh",display:"flex"}}>
      <Sidebar view={view} onNav={v=>nav(v)}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {view!=="client-form"&&(
          <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",boxShadow:"0 1px 2px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text}}>{viewLabel[view]||""}</div>
            {view!=="settings"&&<div style={{position:"relative"}}><Search size={13} color={C.textMuted} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)"}}/><input placeholder="Buscar..." style={{background:"#F3F4F6",border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 14px 8px 30px",fontSize:13,color:C.text,outline:"none",width:200}}/></div>}
          </div>
        )}
        <main style={{flex:1}}>
          {view==="dashboard"   &&<Dashboard    clients={clients} onNav={nav}/>}
          {view==="clients"     &&<ClientsView  clients={clients} onNav={nav}/>}
          {view==="billing"     &&<FacturacionView clients={clients} onUpdateClient={updateClient} config={config}/>}
          {view==="settings"    &&<ConfiguracionView config={config} onSave={saveConfig}/>}
          {view==="client-form" &&<ClientForm client={editingClient} isNew={!editId} onSave={saveClient} onDelete={deleteClient} onBack={()=>nav("clients")}/>}
        </main>
      </div>
    </div>
  );
}
