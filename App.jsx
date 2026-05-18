import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, DollarSign, TrendingUp, TrendingDown,
  BarChart2, Plus, ArrowLeft, Trash2, ChevronRight, ChevronDown,
  Search, Settings, HelpCircle, Zap, Briefcase,
} from "lucide-react";

// ── Utils ─────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return fmt(n);
};

const RESOURCE_TYPES = ["Diseñador", "Desarrollador", "PM", "Sales Rep", "Soporte"];
const STORAGE_KEY = "finpanel_clients_v1";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          "#F0F3FA",
  white:       "#FFFFFF",
  border:      "#ECEEF6",
  shadow:      "0 1px 4px rgba(0,0,0,0.06)",
  purple:      "#5B4CF5",
  purpleLight: "rgba(91,76,245,0.08)",
  green:       "#16A34A",
  greenBg:     "#DCFCE7",
  red:         "#DC2626",
  redBg:       "#FEE2E2",
  violet:      "#7C3AED",
  violetBg:    "#EDE9FE",
  text:        "#111827",
  textSub:     "#6B7280",
  textMuted:   "#9CA3AF",
};

// ── Calculations ──────────────────────────────────────────────────────────────
const calcCosts = (c) => {
  const r = (c.resources || []).reduce((s, r) => s + (+r.hourlyRate || 0) * (+r.hours || 0), 0);
  const s = (c.subscriptions || []).filter((x) => x.isRegular).reduce((s, x) => s + (+x.cost || 0), 0);
  return r + s;
};
const calcIncome = (c) => (+c.monthlyFixed || 0) + (+c.monthlyVariable || 0);

const blankClient = () => ({
  id: uid(), name: "", company: "", email: "", phone: "", notes: "",
  active: true, implementationIncome: 0,
  monthlyFixed: 0, monthlyVariable: 0,
  resources: [], subscriptions: [],
  createdAt: new Date().toISOString(),
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ view, onNav }) {
  const navItems = [
    { id: "dashboard", label: "Dashboard",    Icon: LayoutDashboard },
    { id: "clients",   label: "Clientes",      Icon: Users },
    { id: "income",    label: "Ingresos",       Icon: DollarSign,  disabled: true },
    { id: "settings",  label: "Configuración", Icon: Settings,    disabled: true },
    { id: "help",      label: "Ayuda",          Icon: HelpCircle,  disabled: true },
  ];
  return (
    <aside style={{
      width: 235, flexShrink: 0, background: C.white,
      borderRight: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", minHeight: "100vh",
      position: "sticky", top: 0, height: "100vh", overflowY: "auto",
    }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Briefcase size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>FinPanel</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>v 1.0</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "14px 12px" }}>
        {navItems.map(({ id, label, Icon, disabled }) => {
          const active = view === id || (view === "client-form" && id === "clients");
          return (
            <button key={id} onClick={() => !disabled && onNav(id)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "10px 14px",
              background: active ? C.purple : "transparent",
              border: "none", borderRadius: 10,
              color: active ? "white" : disabled ? C.textMuted : C.textSub,
              fontSize: 13, fontWeight: active ? 600 : 400,
              cursor: disabled ? "default" : "pointer",
              marginBottom: 3, opacity: disabled ? 0.45 : 1,
              textAlign: "left", transition: "background 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={16} />{label}
              </div>
              {!active && !disabled && <ChevronRight size={13} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "0 14px 14px" }}>
        <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)", borderRadius: 16, padding: "20px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: 1.4, marginBottom: 6 }}>
            Actualizá a PRO para acceder a todas las funciones
          </div>
          <button style={{ background: "white", color: C.purple, border: "none", borderRadius: 20, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>
            Obtener PRO ahora ✨
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.purple, flexShrink: 0 }}>FP</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Mi Empresa</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Administrador</div>
          </div>
        </div>
        <ChevronDown size={14} color={C.textMuted} />
      </div>
    </aside>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, positive, Icon, iconBg, iconColor }) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "22px", boxShadow: C.shadow }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: iconBg || C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={23} color={iconColor || C.green} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
          {sub && (
            <div style={{ fontSize: 12, color: positive === false ? C.red : C.green, marginTop: 7, display: "flex", alignItems: "center", gap: 3 }}>
              {positive === false ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ active }) {
  return (
    <span style={{ display: "inline-block", padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${active ? C.green : C.red}`, color: active ? C.green : C.red, background: active ? C.greenBg : C.redBg }}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ── Clients table ─────────────────────────────────────────────────────────────
function ClientRow({ client, onClick, last }) {
  const [hov, setHov] = useState(false);
  const inc    = calcIncome(client);
  const cost   = calcCosts(client);
  const margin = inc - cost;
  return (
    <tr onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderBottom: !last ? `1px solid ${C.border}` : "none", background: hov ? "#F8F9FF" : C.white, cursor: "pointer", transition: "background 0.1s" }}>
      <td style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.purple }}>
            {(client.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{client.name || "(sin nombre)"}</div>
            {client.email && <div style={{ fontSize: 11, color: C.textMuted }}>{client.email}</div>}
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 20px", color: C.textSub, fontSize: 13 }}>{client.company || "—"}</td>
      <td style={{ padding: "14px 20px", color: C.textSub, fontSize: 13 }}>{client.phone   || "—"}</td>
      <td style={{ padding: "14px 20px", color: C.green,   fontWeight: 600, fontSize: 13 }}>{fmt(inc)}</td>
      <td style={{ padding: "14px 20px", color: C.red,     fontWeight: 600, fontSize: 13 }}>{fmt(cost)}</td>
      <td style={{ padding: "14px 20px", fontWeight: 700,  fontSize: 13, color: margin >= 0 ? C.green : C.red }}>{fmt(margin)}</td>
      <td style={{ padding: "14px 20px" }}><StatusBadge active={client.active} /></td>
    </tr>
  );
}

function ClientsTable({ clients, onSelect }) {
  const heads = ["Cliente", "Empresa", "Teléfono", "Ingreso/mes", "Costo/mes", "Margen", "Estado"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h} style={{ padding: "12px 20px", textAlign: "left", color: C.textMuted, fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((c, i) => (
            <ClientRow key={c.id} client={c} onClick={() => onSelect(c.id)} last={i === clients.length - 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ clients, onNav }) {
  const active    = clients.filter((c) => c.active);
  const totalInc  = active.reduce((s, c) => s + calcIncome(c), 0);
  const totalCost = active.reduce((s, c) => s + calcCosts(c),  0);
  const margin    = totalInc - totalCost;
  const totalImpl = clients.reduce((s, c) => s + (+c.implementationIncome || 0), 0);

  return (
    <div style={{ padding: "28px", maxWidth: 1200 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <KPICard label="Clientes activos"  value={active.length}      sub={`${clients.length} totales`}                      positive={true}        Icon={Users}     iconBg={C.greenBg}                      iconColor={C.green}  />
        <KPICard label="Ingresos / mes"    value={fmtK(totalInc)}     sub={`Anual: ${fmtK(totalInc * 12)}`}                  positive={true}        Icon={DollarSign} iconBg={C.greenBg}                     iconColor={C.green}  />
        <KPICard label="Costos / mes"      value={fmtK(totalCost)}    sub={`Anual: ${fmtK(totalCost * 12)}`}                 positive={false}       Icon={BarChart2}  iconBg={C.redBg}                       iconColor={C.red}    />
        <KPICard label="Margen / mes"      value={fmtK(margin)}       sub={totalInc > 0 ? `${Math.round((margin / totalInc) * 100)}% del ingreso` : "Sin ingresos"} positive={margin >= 0} Icon={TrendingUp} iconBg={margin >= 0 ? C.greenBg : C.redBg} iconColor={margin >= 0 ? C.green : C.red} />
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <KPICard label="Implementaciones"        value={fmtK(totalImpl)}      sub="ingresos one-time acumulados" positive={true}        Icon={Zap}        iconBg={C.violetBg}                     iconColor={C.violet} />
        <KPICard label="Proyección anual"         value={fmtK(totalInc * 12)} sub="clientes activos"              positive={true}        Icon={TrendingUp} iconBg={C.greenBg}                      iconColor={C.green}  />
        <KPICard label="Margen anual proyectado"  value={fmtK(margin * 12)}   sub="sobre clientes activos"        positive={margin >= 0} Icon={BarChart2}  iconBg={margin >= 0 ? C.greenBg : C.redBg} iconColor={margin >= 0 ? C.green : C.red} />
      </div>

      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Todos los clientes</div>
            <div style={{ fontSize: 12, color: C.green, marginTop: 3 }}>{active.length} clientes activos</div>
          </div>
          <button onClick={() => onNav("client-form")} style={{ background: C.purple, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nuevo cliente
          </button>
        </div>
        {clients.length === 0 ? (
          <div style={{ padding: "56px 32px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Users size={28} color={C.green} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No hay clientes todavía</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 22 }}>Agregá tu primer cliente para empezar a trackear tus finanzas</div>
            <button onClick={() => onNav("client-form")} style={{ background: C.purple, color: "white", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Nuevo cliente
            </button>
          </div>
        ) : (
          <>
            <ClientsTable clients={clients} onSelect={(id) => onNav("client-form", id)} />
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>Mostrando {clients.length} clientes</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Clients list view ─────────────────────────────────────────────────────────
function ClientsView({ clients, onNav }) {
  const [q,      setQ]      = useState("");
  const [filter, setFilter] = useState("all");

  let filtered = clients.filter((c) =>
    `${c.name}${c.company}${c.email}`.toLowerCase().includes(q.toLowerCase())
  );
  if (filter === "active")   filtered = filtered.filter((c) =>  c.active);
  if (filter === "inactive") filtered = filtered.filter((c) => !c.active);

  return (
    <div style={{ padding: "28px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Todos los clientes</h1>
        <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>{clients.filter((c) => c.active).length} clientes activos</div>
      </div>
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={14} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente..."
              style={{ width: "100%", background: "#F4F6FB", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px 9px 34px", fontSize: 13, color: C.text, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ id: "all", label: "Todos" }, { id: "active", label: "Activos" }, { id: "inactive", label: "Inactivos" }].map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 500, border: `1px solid ${filter === f.id ? C.purple : C.border}`, background: filter === f.id ? C.purpleLight : C.white, color: filter === f.id ? C.purple : C.textSub, borderRadius: 8, cursor: "pointer" }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => onNav("client-form")} style={{ background: C.purple, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> Nuevo
          </button>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "52px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            {q || filter !== "all" ? "No hay resultados para esa búsqueda" : "No hay clientes registrados"}
          </div>
        ) : (
          <>
            <ClientsTable clients={filtered} onSelect={(id) => onNav("client-form", id)} />
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>Mostrando {filtered.length} de {clients.length} clientes</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────────
const inp = {
  width: "100%", background: "#F4F6FB", border: `1px solid #E5E7EB`,
  borderRadius: 10, padding: "10px 14px",
  color: "#111827", fontSize: 13, outline: "none", fontFamily: "inherit",
};

function Fld({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, color: C.textSub, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
      <div style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, background: value ? C.purple : "#D1D5DB", position: "relative", transition: "background 0.2s" }}>
        <div style={{ position: "absolute", top: 3, left: value ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </div>
      {label && <span style={{ fontSize: 13, color: C.textSub, userSelect: "none" }}>{label}</span>}
    </div>
  );
}

// ── Client form ───────────────────────────────────────────────────────────────
function ClientForm({ client, isNew, onSave, onDelete, onBack }) {
  const [form, setForm]             = useState({ ...client });
  const [tab,  setTab]              = useState("info");
  const [confirmDel, setConfirmDel] = useState(false);

  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const addRes = ()         => u("resources",     [...(form.resources     || []), { id: uid(), type: "Desarrollador", hourlyRate: 0, hours: 0 }]);
  const updRes = (id, k, v) => u("resources",     form.resources.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const delRes = (id)       => u("resources",     form.resources.filter((r) => r.id !== id));
  const addSub = ()         => u("subscriptions", [...(form.subscriptions || []), { id: uid(), name: "", cost: 0, isRegular: true }]);
  const updSub = (id, k, v) => u("subscriptions", form.subscriptions.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const delSub = (id)       => u("subscriptions", form.subscriptions.filter((s) => s.id !== id));

  const resCost    = (form.resources     || []).reduce((s, r) => s + (+r.hourlyRate || 0) * (+r.hours || 0), 0);
  const subCostReg = (form.subscriptions || []).filter((s) =>  s.isRegular).reduce((s, x) => s + (+x.cost || 0), 0);
  const subCostAll = (form.subscriptions || []).reduce((s, x) => s + (+x.cost || 0), 0);
  const totalCost  = resCost + subCostReg;
  const totalInc   = (+form.monthlyFixed || 0) + (+form.monthlyVariable || 0);
  const margin     = totalInc - totalCost;

  const tabs = [
    { id: "info",     label: "Info básica" },
    { id: "ingresos", label: "Ingresos" },
    { id: "recursos", label: `Recursos (${(form.resources     || []).length})` },
    { id: "subs",     label: `Suscripciones (${(form.subscriptions || []).length})` },
  ];

  const addBtn = { background: C.purpleLight, color: C.purple, border: `1px solid rgba(91,76,245,0.25)`, borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
  const delBtn = { background: C.white, border: `1px solid ${C.border}`, color: C.red, borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center" };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: C.bg }}>
      {/* Sticky header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "#F3F4F6", border: "none", color: C.textSub, cursor: "pointer", padding: "8px 10px", borderRadius: 9, display: "flex", alignItems: "center" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{isNew ? "Nuevo cliente" : (form.name || "Sin nombre")}</div>
            {!isNew && form.company && <div style={{ fontSize: 11, color: C.textSub }}>{form.company}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Toggle value={form.active} onChange={(v) => u("active", v)} label="Contrato activo" />
          <button onClick={() => onSave(form)} style={{ background: C.purple, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Guardar cliente
          </button>
        </div>
      </div>

      <div style={{ padding: "26px 28px", maxWidth: 820 }}>
        {/* Live summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          {[
            { label: "Ingreso / mes",  val: fmt(totalInc),                        color: C.green,  bg: C.greenBg  },
            { label: "Costo / mes",    val: fmt(totalCost),                       color: C.red,    bg: C.redBg    },
            { label: "Margen / mes",   val: fmt(margin),                          color: margin >= 0 ? C.green : C.red, bg: margin >= 0 ? C.greenBg : C.redBg },
            { label: "Implementación", val: fmt(+form.implementationIncome || 0), color: C.violet, bg: C.violetBg },
          ].map((x) => (
            <div key={x.label} style={{ flex: 1, minWidth: 130, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 5 }}>{x.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: x.color }}>{x.val}</div>
            </div>
          ))}
        </div>

        {/* Tabbed form */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 22px", overflowX: "auto" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${C.purple}` : "2px solid transparent", color: tab === t.id ? C.purple : C.textSub, padding: "14px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "24px 22px" }}>
            {/* Info tab */}
            {tab === "info" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 20px" }}>
                  <Fld label="Nombre"><input value={form.name}    onChange={(e) => u("name",    e.target.value)} placeholder="Juan García"  style={inp} /></Fld>
                  <Fld label="Empresa"><input value={form.company} onChange={(e) => u("company", e.target.value)} placeholder="Acme Corp"     style={inp} /></Fld>
                  <Fld label="Email"><input   value={form.email}   onChange={(e) => u("email",   e.target.value)} placeholder="juan@acme.com" style={inp} /></Fld>
                  <Fld label="Teléfono"><input value={form.phone}  onChange={(e) => u("phone",   e.target.value)} placeholder="+54 9 11..."   style={inp} /></Fld>
                </div>
                <Fld label="Notas">
                  <textarea value={form.notes} onChange={(e) => u("notes", e.target.value)} rows={4}
                    placeholder="Observaciones, contexto del cliente..." style={{ ...inp, resize: "vertical" }} />
                </Fld>
                {!isNew && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                    {!confirmDel ? (
                      <button onClick={() => setConfirmDel(true)} style={{ background: C.white, border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <Trash2 size={13} /> Eliminar cliente
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: C.red }}>¿Confirmar eliminación?</span>
                        <button onClick={onDelete} style={{ background: C.red, color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
                        <button onClick={() => setConfirmDel(false)} style={{ background: C.white, border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Ingresos tab */}
            {tab === "ingresos" && (
              <div>
                <Fld label="Ingreso de implementación (one-time)" hint="Fee único por setup, onboarding o desarrollo inicial">
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 13 }}>$</span>
                    <input type="number" value={form.implementationIncome} onChange={(e) => u("implementationIncome", e.target.value)} style={{ ...inp, paddingLeft: 24 }} min={0} />
                  </div>
                </Fld>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 20px" }}>
                  <Fld label="Ingreso mensual fijo" hint="Retainer, suscripción, fee fijo">
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 13 }}>$</span>
                      <input type="number" value={form.monthlyFixed}    onChange={(e) => u("monthlyFixed",    e.target.value)} style={{ ...inp, paddingLeft: 24 }} min={0} />
                    </div>
                  </Fld>
                  <Fld label="Ingreso mensual variable" hint="Comisiones, uso, overage">
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 13 }}>$</span>
                      <input type="number" value={form.monthlyVariable} onChange={(e) => u("monthlyVariable", e.target.value)} style={{ ...inp, paddingLeft: 24 }} min={0} />
                    </div>
                  </Fld>
                </div>
                <div style={{ background: "#F8FAFF", border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginTop: 4 }}>
                  {[{ label: "Fijo / mes", val: fmt(+form.monthlyFixed || 0) }, { label: "Variable / mes", val: fmt(+form.monthlyVariable || 0) }].map((x) => (
                    <div key={x.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: C.textSub }}>{x.label}</span>
                      <span style={{ color: C.green, fontWeight: 600 }}>{x.val}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ fontWeight: 700, color: C.text }}>Total mensual</span>
                    <span style={{ fontWeight: 800, color: C.green }}>{fmt(totalInc)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: C.textMuted }}>
                    <span>Proyectado anual</span><span>{fmt(totalInc * 12)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recursos tab */}
            {tab === "recursos" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.textSub }}>{(form.resources || []).length} recurso{(form.resources || []).length !== 1 ? "s" : ""} asignado{(form.resources || []).length !== 1 ? "s" : ""}</span>
                  <button onClick={addRes} style={addBtn}><Plus size={12} /> Agregar recurso</button>
                </div>
                {(form.resources || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px", color: C.textMuted, fontSize: 13, background: "#F8FAFF", borderRadius: 10, border: `1px dashed ${C.border}` }}>No hay recursos asignados a este cliente</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {form.resources.map((r) => (
                      <div key={r.id} style={{ background: "#F8FAFF", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                          <Fld label="Tipo de recurso">
                            <select value={r.type} onChange={(e) => updRes(r.id, "type", e.target.value)} style={inp}>
                              {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </Fld>
                          <Fld label="$ / hora"><input type="number" value={r.hourlyRate} onChange={(e) => updRes(r.id, "hourlyRate", e.target.value)} style={inp} min={0} /></Fld>
                          <Fld label="Horas / mes"><input type="number" value={r.hours} onChange={(e) => updRes(r.id, "hours", e.target.value)} style={inp} min={0} /></Fld>
                          <div style={{ paddingBottom: 16 }}><button onClick={() => delRes(r.id)} style={delBtn}><Trash2 size={13} /></button></div>
                        </div>
                        <div style={{ fontSize: 12, color: C.textSub, textAlign: "right" }}>Subtotal: <span style={{ color: C.red, fontWeight: 700 }}>{fmt((+r.hourlyRate || 0) * (+r.hours || 0))}</span></div>
                      </div>
                    ))}
                    <div style={{ background: C.redBg, border: `1px solid #FECACA`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Total recursos / mes</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: C.red }}>{fmt(resCost)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Suscripciones tab */}
            {tab === "subs" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.textSub }}>{(form.subscriptions || []).length} suscripción{(form.subscriptions || []).length !== 1 ? "es" : ""}</span>
                  <button onClick={addSub} style={addBtn}><Plus size={12} /> Agregar suscripción</button>
                </div>
                {(form.subscriptions || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px", color: C.textMuted, fontSize: 13, background: "#F8FAFF", borderRadius: 10, border: `1px dashed ${C.border}` }}>No hay suscripciones asociadas a este cliente</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {form.subscriptions.map((s) => (
                      <div key={s.id} style={{ background: "#F8FAFF", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto auto", gap: 12, alignItems: "end" }}>
                          <Fld label="Nombre / servicio"><input value={s.name} onChange={(e) => updSub(s.id, "name", e.target.value)} placeholder="Vercel, Figma, AWS..." style={inp} /></Fld>
                          <Fld label="Costo / mes ($)"><input type="number" value={s.cost} onChange={(e) => updSub(s.id, "cost", e.target.value)} style={inp} min={0} /></Fld>
                          <Fld label="Regular"><div style={{ paddingTop: 4 }}><Toggle value={s.isRegular} onChange={(v) => updSub(s.id, "isRegular", v)} /></div></Fld>
                          <div style={{ paddingBottom: 16 }}><button onClick={() => delSub(s.id)} style={delBtn}><Trash2 size={13} /></button></div>
                        </div>
                        {!s.isRegular && <div style={{ fontSize: 11, color: C.textMuted }}>No regular — no se incluye en el costo mensual estimado</div>}
                      </div>
                    ))}
                    <div style={{ background: C.redBg, border: `1px solid #FECACA`, borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                        <span style={{ color: C.textSub }}>Suscripciones regulares / mes</span>
                        <span style={{ color: C.red, fontWeight: 700 }}>{fmt(subCostReg)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: C.textMuted }}>Total incluyendo no regulares</span>
                        <span style={{ color: C.textMuted }}>{fmt(subCostAll)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [clients, setClients] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [view,   setView]   = useState("dashboard");
  const [editId, setEditId] = useState(null);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage:", e);
    }
  }, [clients]);

  const nav = (v, id = null) => {
    setView(v);
    if (v === "client-form") setEditId(id);
    window.scrollTo(0, 0);
  };

  const saveClient = (data) => {
    if (!editId) {
      setClients((p) => [...p, { ...blankClient(), ...data }]);
    } else {
      setClients((p) => p.map((c) => (c.id === editId ? { ...c, ...data } : c)));
    }
    nav("clients");
  };

  const deleteClient = () => {
    setClients((p) => p.filter((c) => c.id !== editId));
    nav("clients");
  };

  const editingClient = editId
    ? (clients.find((c) => c.id === editId) || blankClient())
    : blankClient();

  const viewLabel = { dashboard: "Bienvenido 👋", clients: "Clientes" };

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", background: C.bg, color: C.text, minHeight: "100vh", display: "flex" }}>
      <Sidebar view={view} onNav={(v) => nav(v)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {view !== "client-form" && (
          <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{viewLabel[view] || ""}</div>
            <div style={{ position: "relative" }}>
              <Search size={14} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input placeholder="Buscar..." style={{ background: "#F3F4F6", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px 9px 34px", fontSize: 13, color: C.text, outline: "none", width: 200 }} />
            </div>
          </div>
        )}

        <main style={{ flex: 1 }}>
          {view === "dashboard"   && <Dashboard   clients={clients} onNav={nav} />}
          {view === "clients"     && <ClientsView clients={clients} onNav={nav} />}
          {view === "client-form" && (
            <ClientForm
              client={editingClient}
              isNew={!editId}
              onSave={saveClient}
              onDelete={deleteClient}
              onBack={() => nav("clients")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
