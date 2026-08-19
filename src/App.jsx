import { useState, useEffect, useCallback } from "react";
import { Plus, Check, Clock, AlertTriangle, X, Users, Calendar, Receipt, LayoutDashboard, Bell, Trash2, ChevronRight, Wallet, TrendingUp } from "lucide-react";

const FREQUENCIES = ["Weekly", "Biweekly", "Monthly", "One-time"];
const TERMS_OPTIONS = [
  { label: "Due on receipt", days: 0 },
  { label: "7 days", days: 7 },
  { label: "15 days", days: 15 },
  { label: "30 days", days: 30 },
];
// Roughly how many times a recurring service happens per month, used to
// estimate monthly recurring income per client. One-time jobs don't recur,
// so they're excluded from this estimate.
const MONTHLY_MULTIPLIER = { Weekly: 4.33, Biweekly: 2.17, Monthly: 1, "One-time": 0 };

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (dateStr) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtMoney = (n) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(n) || 0);
const uid = () => Math.random().toString(36).slice(2, 10);

const serviceThankYouMessage = (clientName, service) =>
  `Hi ${clientName}, thank you for choosing us for your ${service ? service.toLowerCase() : "service"} today. We appreciate your business — let us know if you need anything else.`;

const paymentThankYouMessage = (clientName, amount) =>
  `Hi ${clientName}, thank you for your payment of ${fmtMoney(amount)}. We appreciate you taking care of it and look forward to continuing to serve your property.`;

const STORAGE_KEY = "landscape-admin-data";

const emptyData = { clients: [], jobs: [], invoices: [], reminderLog: [] };

export default function LandscapeAdmin() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch (e) {
      // no existing data yet, or storage unavailable
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((next) => {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Derived: recompute overdue statuses live (based on due date vs today)
  const invoicesComputed = data.invoices.map((inv) => {
    if (inv.status === "paid") return inv;
    if (inv.dueDate < todayStr()) return { ...inv, status: "overdue" };
    return { ...inv, status: "unpaid" };
  });

  const clientById = (id) => data.clients.find((c) => c.id === id);

  // Auto-detect invoices that just crossed their client's payment terms and
  // log a reminder for them (once per day per invoice). Runs whenever the
  // app is open and data changes — it can't fire while the app is closed,
  // since there's no server running in the background.
  useEffect(() => {
    if (!loaded) return;
    const today = todayStr();
    const alreadyLoggedToday = new Set(
      data.reminderLog.filter((r) => r.date === today).map((r) => r.invoiceId)
    );
    const due = invoicesComputed.filter(
      (inv) => inv.status === "overdue" && !alreadyLoggedToday.has(inv.id)
    );
    if (due.length > 0) {
      const newEntries = due.map((inv) => ({ id: uid(), invoiceId: inv.id, date: today, auto: true }));
      const next = { ...data, reminderLog: [...data.reminderLog, ...newEntries] };
      persist(next);
      const names = due.map((inv) => clientById(inv.clientId)?.name).filter(Boolean);
      showToast(`Reminder sent to ${names.length} client${names.length === 1 ? "" : "s"} past due`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, data.invoices.length]);

  // ---- Actions ----
  const addClient = (client) => {
    const next = { ...data, clients: [...data.clients, { ...client, id: uid() }] };
    persist(next);
    setShowClientForm(false);
    showToast("Client added");
  };

  const deleteClient = (id) => {
    const next = {
      ...data,
      clients: data.clients.filter((c) => c.id !== id),
      jobs: data.jobs.filter((j) => j.clientId !== id),
      invoices: data.invoices.filter((i) => i.clientId !== id),
    };
    persist(next);
    showToast("Client removed");
  };

  const addJob = (job) => {
    const next = { ...data, jobs: [...data.jobs, { ...job, id: uid(), status: "scheduled" }] };
    persist(next);
    setShowJobForm(false);
    showToast("Job scheduled");
  };

  const completeJob = (jobId) => {
    const job = data.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const client = clientById(job.clientId);
    const termsDays = client && client.paymentTermsDays != null ? client.paymentTermsDays : 15;
    const dueDate = addDays(todayStr(), termsDays);
    const invoice = {
      id: uid(),
      clientId: job.clientId,
      jobId: job.id,
      amount: client ? Number(client.price) : 0,
      createdDate: todayStr(),
      dueDate,
      status: "unpaid",
    };
    const next = {
      ...data,
      jobs: data.jobs.map((j) => (j.id === jobId ? { ...j, status: "completed" } : j)),
      invoices: [...data.invoices, invoice],
    };
    persist(next);
    showToast(`Job marked done — invoice created for ${client ? client.name : "client"}`);
    if (client) {
      setPendingMessage({
        title: "Thank the client",
        body: serviceThankYouMessage(client.name, client.service),
      });
    }
  };

  const markPaid = (invId) => {
    const inv = data.invoices.find((i) => i.id === invId);
    const next = { ...data, invoices: data.invoices.map((i) => (i.id === invId ? { ...i, status: "paid" } : i)) };
    persist(next);
    showToast("Marked as paid");
    if (inv) {
      const client = clientById(inv.clientId);
      if (client) {
        setPendingMessage({
          title: "Thank the client for paying",
          body: paymentThankYouMessage(client.name, inv.amount),
        });
      }
    }
  };

  const deleteJob = (jobId) => {
    const next = { ...data, jobs: data.jobs.filter((j) => j.id !== jobId) };
    persist(next);
  };

  // ---- Stats ----
  const outstanding = invoicesComputed.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  const overdueCount = invoicesComputed.filter((i) => i.status === "overdue").length;
  const upcomingJobs = data.jobs.filter((j) => j.status === "scheduled").length;

  if (!loaded) {
    return (
      <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", fontFamily: "var(--font-sans)" }}>
      <h2 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
        Landscaping business admin dashboard with clients, jobs, and payment reminders
      </h2>

      {saveError && (
        <div style={{ background: "var(--bg-warning)", color: "var(--text-warning)", fontSize: 13, padding: "8px 12px", borderRadius: "var(--radius)", marginBottom: 12 }}>
          Changes aren't saving right now — your data may not persist. Try refreshing.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", borderBottom: "0.5px solid var(--border)" }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "clients", label: "Clients", icon: Users },
          { id: "jobs", label: "Jobs", icon: Calendar },
          { id: "invoices", label: "Invoices", icon: Receipt },
          { id: "outstanding", label: "Outstanding", icon: Wallet },
          { id: "income", label: "Estimated income", icon: TrendingUp },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                border: "none",
                background: "none",
                padding: "8px 14px",
                fontSize: 14,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: active ? 500 : 400,
                borderBottom: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {toast && (
        <div style={{ background: "var(--bg-success)", color: "var(--text-success)", fontSize: 13, padding: "8px 12px", borderRadius: "var(--radius)", marginBottom: 12 }}>
          {toast}
        </div>
      )}

      {tab === "dashboard" && (
        <Dashboard
          outstanding={outstanding}
          overdueCount={overdueCount}
          upcomingJobs={upcomingJobs}
          invoices={invoicesComputed}
          reminderLog={data.reminderLog}
          onMarkPaid={markPaid}
          clientById={clientById}
        />
      )}

      {tab === "clients" && (
        <ClientsTab
          clients={data.clients}
          onAdd={() => setShowClientForm(true)}
          onDelete={deleteClient}
        />
      )}

      {tab === "jobs" && (
        <JobsTab
          jobs={data.jobs}
          clients={data.clients}
          clientById={clientById}
          onAdd={() => setShowJobForm(true)}
          onComplete={completeJob}
          onDelete={deleteJob}
        />
      )}

      {tab === "invoices" && (
        <InvoicesTab invoices={invoicesComputed} clientById={clientById} reminderLog={data.reminderLog} onMarkPaid={markPaid} />
      )}

      {tab === "outstanding" && (
        <OutstandingTab invoices={invoicesComputed} clientById={clientById} />
      )}

      {tab === "income" && (
        <IncomeTab clients={data.clients} jobs={data.jobs} clientById={clientById} />
      )}

      {showClientForm && <ClientFormModal onSave={addClient} onClose={() => setShowClientForm(false)} />}
      {showJobForm && <JobFormModal clients={data.clients} onSave={addJob} onClose={() => setShowJobForm(false)} />}
      {pendingMessage && (
        <MessageModal title={pendingMessage.title} body={pendingMessage.body} onClose={() => setPendingMessage(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "1rem", flex: 1 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: "4px 0 0", color: tone || "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function Dashboard({ outstanding, overdueCount, upcomingJobs, invoices, reminderLog, clientById, onMarkPaid }) {
  const needsAttention = invoices
    .filter((i) => i.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const reminderCount = (invId) => reminderLog.filter((r) => r.invoiceId === invId).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem" }}>
        <StatCard label="Outstanding" value={fmtMoney(outstanding)} />
        <StatCard label="Overdue invoices" value={overdueCount} tone={overdueCount > 0 ? "var(--text-danger)" : undefined} />
        <StatCard label="Upcoming jobs" value={upcomingJobs} />
      </div>

      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 8px" }}>Needs attention</p>
      {needsAttention.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Nothing outstanding right now.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {needsAttention.map((inv) => {
            const client = clientById(inv.clientId);
            const overdue = inv.status === "overdue";
            return (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--surface-2)",
                  border: "0.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {overdue ? (
                    <AlertTriangle size={16} color="var(--text-danger)" />
                  ) : (
                    <Clock size={16} color="var(--text-secondary)" />
                  )}
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{client ? client.name : "Unknown client"}</p>
                    <p style={{ fontSize: 12, color: overdue ? "var(--text-danger)" : "var(--text-secondary)", margin: 0 }}>
                      {fmtMoney(inv.amount)} · {overdue ? `overdue since ${fmtDate(inv.dueDate)}` : `due ${fmtDate(inv.dueDate)}`}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {overdue && reminderCount(inv.id) > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                      <Bell size={12} /> {reminderCount(inv.id)} sent
                    </span>
                  )}
                  <button onClick={() => onMarkPaid(inv.id)} style={{ fontSize: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={13} /> Paid
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientsTab({ clients, onAdd, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>{clients.length} client{clients.length === 1 ? "" : "s"}</p>
        <button onClick={onAdd} style={{ fontSize: 13, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={14} /> Add client
        </button>
      </div>
      {clients.length === 0 ? (
        <EmptyState text="No clients yet. Add your first one to get started." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {clients.map((c) => (
            <div key={c.id} style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{c.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>{c.address}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                  {c.service} · {c.frequency} · {fmtMoney(c.price)}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Terms: {c.paymentTermsDays === 0 ? "due on receipt" : `${c.paymentTermsDays} days`}
                </p>
              </div>
              <button onClick={() => onDelete(c.id)} aria-label={`Delete ${c.name}`} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6 }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobsTab({ jobs, clientById, onAdd, onComplete, onDelete }) {
  const sorted = [...jobs].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>{jobs.filter((j) => j.status === "scheduled").length} scheduled</p>
        <button onClick={onAdd} style={{ fontSize: 13, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={14} /> Schedule job
        </button>
      </div>
      {sorted.length === 0 ? (
        <EmptyState text="No jobs scheduled yet." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((j) => {
            const client = clientById(j.clientId);
            const done = j.status === "completed";
            return (
              <div key={j.id} style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{client ? client.name : "Unknown client"}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>{fmtDate(j.date)} · {done ? "Completed" : "Scheduled"}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {!done && (
                    <button onClick={() => onComplete(j.id)} style={{ fontSize: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                      <Check size={13} /> Mark done
                    </button>
                  )}
                  <button onClick={() => onDelete(j.id)} aria-label="Delete job" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvoicesTab({ invoices, clientById, reminderLog, onMarkPaid }) {
  const sorted = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const statusColor = (s) => (s === "paid" ? "var(--text-success)" : s === "overdue" ? "var(--text-danger)" : "var(--text-secondary)");
  const reminderCount = (invId) => reminderLog.filter((r) => r.invoiceId === invId).length;
  return (
    <div>
      {sorted.length === 0 ? (
        <EmptyState text="No invoices yet. Mark a job as done to generate one." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((inv) => {
            const client = clientById(inv.clientId);
            return (
              <div key={inv.id} style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{client ? client.name : "Unknown client"} · {fmtMoney(inv.amount)}</p>
                  <p style={{ fontSize: 12, margin: "2px 0 0", color: statusColor(inv.status) }}>
                    {inv.status === "paid" ? "Paid" : inv.status === "overdue" ? `Overdue since ${fmtDate(inv.dueDate)}` : `Due ${fmtDate(inv.dueDate)}`}
                    {inv.status === "overdue" && reminderCount(inv.id) > 0 ? ` · ${reminderCount(inv.id)} reminder${reminderCount(inv.id) === 1 ? "" : "s"} sent` : ""}
                  </p>
                </div>
                {inv.status !== "paid" && (
                  <button onClick={() => onMarkPaid(inv.id)} style={{ fontSize: 12, padding: "6px 10px" }}>Mark paid</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OutstandingTab({ invoices, clientById }) {
  const unpaid = invoices.filter((i) => i.status !== "paid");
  const totalOutstanding = unpaid.reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = unpaid.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
  const totalNotYetDue = totalOutstanding - totalOverdue;

  // Group by client so the owner can see who owes the most, not just per invoice.
  const byClient = {};
  unpaid.forEach((inv) => {
    if (!byClient[inv.clientId]) byClient[inv.clientId] = { total: 0, overdue: 0, count: 0 };
    byClient[inv.clientId].total += Number(inv.amount);
    byClient[inv.clientId].count += 1;
    if (inv.status === "overdue") byClient[inv.clientId].overdue += Number(inv.amount);
  });
  const clientRows = Object.entries(byClient)
    .map(([clientId, v]) => ({ clientId, ...v }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem" }}>
        <StatCard label="Total outstanding" value={fmtMoney(totalOutstanding)} />
        <StatCard label="Overdue" value={fmtMoney(totalOverdue)} tone={totalOverdue > 0 ? "var(--text-danger)" : undefined} />
        <StatCard label="Not yet due" value={fmtMoney(totalNotYetDue)} />
      </div>

      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 8px" }}>By client</p>
      {clientRows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Nothing outstanding right now.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {clientRows.map((row) => {
            const client = clientById(row.clientId);
            return (
              <div key={row.clientId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{client ? client.name : "Unknown client"}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    {row.count} unpaid invoice{row.count === 1 ? "" : "s"}
                    {row.overdue > 0 ? ` · ${fmtMoney(row.overdue)} overdue` : ""}
                  </p>
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{fmtMoney(row.total)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IncomeTab({ clients, jobs, clientById }) {
  // Monthly recurring estimate: each active client's price times how often
  // their service repeats per month. One-time clients don't contribute.
  const recurringRows = clients
    .map((c) => ({ client: c, monthly: Number(c.price) * (MONTHLY_MULTIPLIER[c.frequency] || 0) }))
    .filter((r) => r.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
  const monthlyEstimate = recurringRows.reduce((s, r) => s + r.monthly, 0);

  // Value of jobs already on the schedule but not yet completed/invoiced.
  const scheduledJobs = jobs.filter((j) => j.status === "scheduled");
  const scheduledValue = scheduledJobs.reduce((s, j) => {
    const client = clientById(j.clientId);
    return s + (client ? Number(client.price) : 0);
  }, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem" }}>
        <StatCard label="Estimated monthly income" value={fmtMoney(monthlyEstimate)} />
        <StatCard label="Value of scheduled jobs" value={fmtMoney(scheduledValue)} />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "-1rem 0 1.5rem" }}>
        Monthly income is estimated from each client's price and how often their service repeats. It's a projection, not a guarantee — actual income depends on jobs completed and invoices paid.
      </p>

      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 8px" }}>By client</p>
      {recurringRows.length === 0 ? (
        <EmptyState text="No recurring clients yet. Add a client with a repeating frequency to see an estimate." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recurringRows.map((row) => (
            <div key={row.client.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{row.client.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                  {fmtMoney(row.client.price)} · {row.client.frequency}
                </p>
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{fmtMoney(row.monthly)}/mo</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)", fontSize: 14 }}>
      {text}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "static", minHeight: 320, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
      <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "1.25rem", width: 340, border: "0.5px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{title}</p>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MessageModal({ title, body, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopied(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px" }}>
        Copy this and send it however you'd usually message the client — text, email, or WhatsApp.
      </p>
      <textarea
        readOnly
        value={body}
        rows={4}
        style={{ width: "100%", fontFamily: "inherit", fontSize: 13, padding: "8px 10px", borderRadius: "var(--radius)", border: "0.5px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--text-primary)", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={copy} style={{ flex: 1 }}>{copied ? "Copied" : "Copy message"}</button>
        <button onClick={onClose} style={{ flex: 1 }}>Skip</button>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function ClientFormModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", service: "", price: "", frequency: "Biweekly", paymentTermsDays: 15 });
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.name.trim() || !form.price || Number(form.price) <= 0) {
      setError("Enter a client name and a price greater than 0.");
      return;
    }
    onSave({ ...form, price: Number(form.price), paymentTermsDays: Number(form.paymentTermsDays) });
  };

  return (
    <Modal title="Add client" onClose={onClose}>
      <Field label="Client name">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Maria Alvarez" style={{ width: "100%" }} />
      </Field>
      <Field label="Address">
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Oak St" style={{ width: "100%" }} />
      </Field>
      <Field label="Phone">
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" style={{ width: "100%" }} />
      </Field>
      <Field label="Email">
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="maria@email.com" style={{ width: "100%" }} />
      </Field>
      <Field label="Service">
        <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="Lawn mowing" style={{ width: "100%" }} />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Field label="Price per visit">
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="80" style={{ width: "100%" }} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Frequency">
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} style={{ width: "100%" }}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Payment terms">
        <select value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} style={{ width: "100%" }}>
          {TERMS_OPTIONS.map((t) => (
            <option key={t.days} value={t.days}>{t.label}</option>
          ))}
        </select>
      </Field>
      {error && <p style={{ fontSize: 13, color: "var(--text-danger)", margin: "0 0 10px" }}>{error}</p>}
      <button onClick={submit} style={{ width: "100%", marginTop: 4 }}>Save client</button>
    </Modal>
  );
}

function JobFormModal({ clients, onSave, onClose }) {
  const [form, setForm] = useState({ clientId: clients[0]?.id || "", date: todayStr() });
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.clientId) {
      setError("Add a client first, then schedule their job.");
      return;
    }
    onSave(form);
  };

  return (
    <Modal title="Schedule job" onClose={onClose}>
      {clients.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-danger)" }}>Add a client before scheduling a job.</p>
      ) : (
        <>
          <Field label="Client">
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} style={{ width: "100%" }}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={{ width: "100%" }} />
          </Field>
        </>
      )}
      {error && <p style={{ fontSize: 13, color: "var(--text-danger)", margin: "0 0 10px" }}>{error}</p>}
      <button onClick={submit} style={{ width: "100%", marginTop: 4 }} disabled={clients.length === 0}>Schedule</button>
    </Modal>
  );
}