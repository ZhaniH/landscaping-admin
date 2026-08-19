import { useState, useEffect, useMemo } from "react";
import { Check } from "lucide-react";
import { supabase } from "./supabaseClient.js";

// Business hours: weekdays only, hourly slots 8am-4pm (last slot starts 3pm).
const OPEN_HOUR = 8;
const CLOSE_HOUR = 16;
const SLOT_HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);

const fmtHour = (h) => {
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const isWeekday = (dateStr) => {
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day >= 1 && day <= 5;
};

const nextWeekdays = (count) => {
  const days = [];
  let d = new Date();
  while (days.length < count) {
    const iso = d.toISOString().slice(0, 10);
    if (isWeekday(iso)) days.push(iso);
    d.setDate(d.getDate() + 1);
  }
  return days;
};

export default function BookingPage() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [takenTimes, setTakenTimes] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const availableDates = useMemo(() => nextWeekdays(10), []);

  useEffect(() => {
    if (!date) return;
    setLoadingSlots(true);
    setTime("");
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("bookings")
          .select("time,status")
          .eq("date", date)
          .in("status", ["pending", "approved"]);
        if (err) throw err;
        setTakenTimes((data || []).map((r) => r.time));
      } catch (e) {
        setTakenTimes([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [date]);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !date || !time) {
      setError("Fill in your name, phone number, and pick a date and time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error: err } = await supabase.from("bookings").insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        service: form.service.trim(),
        date,
        time,
        status: "pending",
      });
      if (err) throw err;
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong submitting your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 420, margin: "3rem auto", textAlign: "center", padding: "0 1rem" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <Check size={24} color="var(--text-success)" />
        </div>
        <p style={{ fontSize: 18, fontWeight: 500, margin: "0 0 8px" }}>Request sent</p>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          We'll confirm your {fmtHour(Number(time.split(":")[0]))} slot on {date} shortly.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px" }}>Book a visit</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 1.5rem" }}>
        Pick a date and time that works for you — we'll confirm shortly after.
      </p>

      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Date</label>
      <select value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
        <option value="">Select a date</option>
        {availableDates.map((d) => (
          <option key={d} value={d}>
            {new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", month: "short", day: "numeric" })}
          </option>
        ))}
      </select>

      {date && (
        <>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Time</label>
          {loadingSlots ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Checking availability...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 14 }}>
              {SLOT_HOURS.map((h) => {
                const slot = `${String(h).padStart(2, "0")}:00`;
                const taken = takenTimes.includes(slot);
                const selected = time === slot;
                return (
                  <button
                    key={slot}
                    disabled={taken}
                    onClick={() => setTime(slot)}
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      background: selected ? "var(--text-primary)" : "var(--surface-2)",
                      color: selected ? "var(--surface-2)" : taken ? "var(--text-muted)" : "var(--text-primary)",
                      textDecoration: taken ? "line-through" : "none",
                    }}
                  >
                    {fmtHour(h)}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Your name</label>
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Maria Alvarez" style={{ width: "100%", marginBottom: 14 }} />

      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Phone</label>
      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="082 123 4567" style={{ width: "100%", marginBottom: 14 }} />

      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Email (optional)</label>
      <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="maria@email.com" style={{ width: "100%", marginBottom: 14 }} />

      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>What service do you need?</label>
      <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="Lawn mowing" style={{ width: "100%", marginBottom: 14 }} />

      {error && <p style={{ fontSize: 13, color: "var(--text-danger)", margin: "0 0 10px" }}>{error}</p>}

      <button onClick={submit} disabled={submitting} style={{ width: "100%" }}>
        {submitting ? "Sending..." : "Request this slot"}
      </button>
    </div>
  );
}
