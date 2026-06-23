import { useState, useMemo, useCallback, useEffect, useRef, createContext, useContext, ReactNode, createElement } from "react";
import { Company, IcpFit, TimePeriod, CompanyStatus, Contact, ContactedFrom, Sdr, Activity, Task, FIT_RANK, CompanySize, ProspectionSequence } from "@/types/company";
import { supabase } from "@/integrations/supabase/client";
import { mergeCompanyData, findDuplicateClusters } from "@/lib/duplicates";
import { Meeting, MeetingGoal, AccountExecutive } from "@/types/meeting";
import { getIsoWeek } from "@/lib/week";

interface Filters {
  icpFit: IcpFit | "ALL";
  country: string;
  industry: string;
  status: CompanyStatus | "ALL";
  sdr: Sdr | "ALL" | "UNASSIGNED";
  timePeriod: TimePeriod;
  search: string;
  sortBy?: "default" | "contacted_desc" | "contacted_asc";
}

const defaultFilters: Filters = {
  icpFit: "ALL", country: "ALL", industry: "ALL", status: "ALL",
  sdr: "ALL", timePeriod: "all", search: "", sortBy: "default",
};

type CompanyRow = {
  id: string; company_name: string; domain: string; industry: string;
  size: string; country: string; linkedin_url: string; icp_fit: string;
  reasoning: string; angle: string; status: string;
  unqualified_reason: string | null; sdr: string | null; notes: string;
  amigos: boolean; reviewed: boolean; created_at: string;
  experiencia_target: string | null;
  additional_sdrs: string[] | null;
};
type ContactRow = { id: string; company_id: string; name: string; role: string; email: string | null; phone: string | null; linkedin: string; contacted_from: string[] | string | null };

function normalizeContactedFrom(v: unknown): ContactedFrom[] {
  if (Array.isArray(v)) return v.filter(Boolean) as ContactedFrom[];
  if (typeof v === "string" && v) return [v as ContactedFrom];
  return [];
}
type TaskRow = { id: string; company_id: string; company_name: string; sdr: string | null; title: string; due_at: string; completed: boolean; created_at: string };
type ActivityRow = { id: string; type: string; company_id: string; company_name: string; sdr: string | null; from_status: string | null; to_status: string | null; contact_name: string | null; created_at: string };
type MeetingRow = { id: string; company_id: string; company_name: string; account_executive: string; sdr: string | null; scheduled_at: string; iso_year: number; iso_week: number; notes: string; created_at: string; outcome: string | null; outcome_reason: string | null; gcal_event_id?: string | null };
type GoalRow = { id: string; iso_year: number; iso_week: number; account_executive: string; goal: number };
type SequenceRow = { id: string; company_id: string; sdr: string | null; linkedin_account: string | null; started_at: string; ended_at: string | null; end_reason: string | null };

function mapSequence(r: SequenceRow): ProspectionSequence {
  return {
    id: r.id,
    company_id: r.company_id,
    sdr: (r.sdr as Sdr) ?? null,
    linkedin_account: (r.linkedin_account as ContactedFrom) ?? null,
    started_at: new Date(r.started_at).getTime(),
    ended_at: r.ended_at ? new Date(r.ended_at).getTime() : null,
    end_reason: r.end_reason ?? null,
  };
}

function mapMeeting(r: MeetingRow): Meeting {
  return {
    id: r.id,
    company_id: r.company_id,
    company_name: r.company_name,
    account_executive: r.account_executive as AccountExecutive,
    sdr: r.sdr,
    scheduled_at: new Date(r.scheduled_at).getTime(),
    iso_year: r.iso_year,
    iso_week: r.iso_week,
    notes: r.notes ?? "",
    created_at: new Date(r.created_at).getTime(),
    outcome: (r.outcome as Meeting["outcome"]) ?? null,
    outcome_reason: r.outcome_reason ?? null,
    gcal_event_id: r.gcal_event_id ?? null,
  };
}
function mapGoal(r: GoalRow): MeetingGoal {
  return {
    id: r.id,
    iso_year: r.iso_year,
    iso_week: r.iso_week,
    account_executive: r.account_executive as AccountExecutive,
    goal: r.goal,
  };
}

function mapCompany(row: CompanyRow, contacts: Contact[]): Company {
  return {
    id: row.id,
    company_name: row.company_name,
    domain: row.domain,
    industry: row.industry,
    size: (row.size as CompanySize) || "MID",
    country: row.country,
    linkedin_url: row.linkedin_url,
    icp_fit: row.icp_fit as IcpFit,
    reasoning: row.reasoning,
    angle: row.angle as Company["angle"],
    contacts,
    status: row.status as CompanyStatus,
    unqualified_reason: row.unqualified_reason ?? undefined,
    sdr: (row.sdr as Sdr) ?? null,
    additional_sdrs: (row.additional_sdrs ?? []) as Sdr[],
    notes: row.notes ?? "",
    amigos: row.amigos,
    reviewed: row.reviewed,
    created_at: row.created_at.split("T")[0],
    experiencia_target: row.experiencia_target ?? null,
  };
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    company_id: row.company_id,
    company_name: row.company_name,
    sdr: (row.sdr as Sdr) ?? null,
    title: row.title,
    due_at: new Date(row.due_at).getTime(),
    completed: row.completed,
    created_at: new Date(row.created_at).getTime(),
  };
}

function mapActivity(row: ActivityRow): Activity {
  const ts = new Date(row.created_at);
  return {
    id: row.id,
    type: row.type as Activity["type"],
    company_id: row.company_id,
    company_name: row.company_name,
    sdr: (row.sdr as Sdr) ?? null,
    date: ts.toISOString().split("T")[0],
    timestamp: ts.getTime(),
    from_status: (row.from_status as CompanyStatus) ?? undefined,
    to_status: (row.to_status as CompanyStatus) ?? undefined,
    contact_name: row.contact_name ?? undefined,
  };
}

function companyToInsert(c: Company) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id);
  const base = {
    company_name: c.company_name,
    domain: c.domain,
    industry: c.industry,
    size: c.size,
    country: c.country,
    linkedin_url: c.linkedin_url,
    icp_fit: c.icp_fit,
    reasoning: c.reasoning,
    angle: c.angle,
    status: c.status,
    unqualified_reason: c.unqualified_reason ?? null,
    sdr: c.sdr ?? null,
    additional_sdrs: c.additional_sdrs ?? [],
    notes: c.notes,
    amigos: c.amigos ?? false,
    reviewed: c.reviewed,
    experiencia_target: c.experiencia_target ?? null,
  };
  return isUuid ? { id: c.id, ...base } : base;
}

function useCompanyDataInternal() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingGoals, setMeetingGoals] = useState<MeetingGoal[]>([]);
  const [sequences, setSequences] = useState<ProspectionSequence[]>([]);
  const companiesRef = useRef<Company[]>([]);
  useEffect(() => { companiesRef.current = companies; }, [companies]);
  const sequencesRef = useRef<ProspectionSequence[]>([]);
  useEffect(() => { sequencesRef.current = sequences; }, [sequences]);

  const getActiveSequenceId = useCallback((companyId: string): string | null => {
    const list = sequencesRef.current.filter((s) => s.company_id === companyId && s.ended_at === null);
    if (list.length === 0) return null;
    // pick most recent
    list.sort((a, b) => b.started_at - a.started_at);
    return list[0].id;
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Paginate to bypass Supabase's 1000-row cap.
      const fetchAll = async <T,>(
        build: (from: number, to: number) => PromiseLike<{ data: unknown }>,
      ): Promise<T[]> => {
        const pageSize = 1000;
        let offset = 0;
        const all: T[] = [];
        while (true) {
          const { data } = await build(offset, offset + pageSize - 1);
          const batch = (data ?? []) as T[];
          all.push(...batch);
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
        return all;
      };
      const [cRows, kRows, tRows, aRows, mRows, gRows] = await Promise.all([
        fetchAll<CompanyRow>((from, to) =>
          supabase.from("companies").select("*").order("created_at", { ascending: false }).range(from, to)),
        fetchAll<ContactRow>((from, to) =>
          supabase.from("contacts").select("*").range(from, to)),
        fetchAll<TaskRow>((from, to) =>
          supabase.from("tasks").select("*").range(from, to)),
        fetchAll<ActivityRow>((from, to) =>
          supabase.from("activities").select("*").order("created_at", { ascending: false }).range(from, to)),
        fetchAll<MeetingRow>((from, to) =>
          supabase.from("meetings").select("*").order("scheduled_at", { ascending: false }).range(from, to)),
        fetchAll<GoalRow>((from, to) =>
          supabase.from("meeting_goals").select("*").range(from, to)),
      ]);
      const sRows = await fetchAll<SequenceRow>((from, to) =>
        supabase.from("prospection_sequences").select("*").range(from, to));
      if (cancelled) return;
      const contactsByCompany = new Map<string, Contact[]>();
      kRows.forEach((k: ContactRow) => {
        const list = contactsByCompany.get(k.company_id) ?? [];
        list.push({ name: k.name, role: k.role, email: k.email ?? undefined, phone: k.phone ?? undefined, linkedin: k.linkedin, contacted_from: normalizeContactedFrom(k.contacted_from) });
        contactsByCompany.set(k.company_id, list);
      });
      setCompanies(cRows.map((r: CompanyRow) => mapCompany(r, contactsByCompany.get(r.id) ?? [])));
      setTasks(tRows.map(mapTask));
      setActivities(aRows.map(mapActivity));
      setMeetings(mRows.map((r) => mapMeeting(r)));
      setMeetingGoals(gRows.map((r) => mapGoal(r)));
      setSequences(sRows.map(mapSequence));
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as CompanyRow;
          setCompanies((prev) => prev.some((c) => c.id === row.id) ? prev : [mapCompany(row, []), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as CompanyRow;
          setCompanies((prev) => prev.map((c) => c.id === row.id ? mapCompany(row, c.contacts) : c));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as { id: string };
          setCompanies((prev) => prev.filter((c) => c.id !== row.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const k = payload.new as ContactRow;
          setCompanies((prev) => prev.map((c) => c.id === k.company_id && !c.contacts.some((x) => x.linkedin === k.linkedin)
            ? { ...c, contacts: [...c.contacts, { name: k.name, role: k.role, email: k.email ?? undefined, phone: k.phone ?? undefined, linkedin: k.linkedin, contacted_from: normalizeContactedFrom(k.contacted_from) }] }
            : c));
        } else if (payload.eventType === "DELETE") {
          const k = payload.old as ContactRow;
          setCompanies((prev) => prev.map((c) => c.id === k.company_id
            ? { ...c, contacts: c.contacts.filter((x) => x.linkedin !== k.linkedin) }
            : c));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const t = mapTask(payload.new as TaskRow);
          setTasks((prev) => prev.some((x) => x.id === t.id) ? prev : [...prev, t]);
        } else if (payload.eventType === "UPDATE") {
          const t = mapTask(payload.new as TaskRow);
          setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
        } else if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          setTasks((prev) => prev.filter((x) => x.id !== id));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activities" }, (payload) => {
        const a = mapActivity(payload.new as ActivityRow);
        setActivities((prev) => prev.some((x) => x.id === a.id) ? prev : [a, ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "activities" }, (payload) => {
        const id = (payload.old as { id: string }).id;
        setActivities((prev) => prev.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prospection_sequences" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const s = mapSequence(payload.new as SequenceRow);
          setSequences((prev) => {
            const idx = prev.findIndex((x) => x.id === s.id);
            if (idx === -1) return [...prev, s];
            const next = prev.slice();
            next[idx] = s;
            return next;
          });
        } else if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          setSequences((prev) => prev.filter((x) => x.id !== id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const logActivity = useCallback(async (a: Omit<Activity, "id" | "date" | "timestamp">) => {
    const sequence_id = getActiveSequenceId(a.company_id);
    await supabase.from("activities").insert({
      type: a.type,
      company_id: a.company_id,
      company_name: a.company_name,
      sdr: a.sdr,
      from_status: a.from_status ?? null,
      to_status: a.to_status ?? null,
      contact_name: a.contact_name ?? null,
      sequence_id,
    });
  }, [getActiveSequenceId]);

  const countries = useMemo(() => [...new Set(companies.map((c) => c.country).filter(Boolean))].sort(), [companies]);
  const industries = useMemo(() => [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort(), [companies]);

  const filteredCompanies = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
    return companies.filter((c) => {
      if (filters.icpFit !== "ALL" && c.icp_fit !== filters.icpFit) return false;
      if (filters.country !== "ALL" && c.country !== filters.country) return false;
      if (filters.industry !== "ALL" && c.industry !== filters.industry) return false;
      if (filters.status !== "ALL" && c.status !== filters.status) return false;
      if (filters.sdr === "UNASSIGNED" && c.sdr) return false;
      if (filters.sdr !== "ALL" && filters.sdr !== "UNASSIGNED" && c.sdr !== filters.sdr) return false;
      if (filters.search && !c.company_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.timePeriod === "today" && c.created_at !== todayStr) return false;
      if (filters.timePeriod === "7days" && c.created_at < sevenDaysAgo) return false;
      return true;
    });
  }, [companies, filters]);

  const topRecommended = useMemo(() => {
    return [...companies]
      .filter((c) => FIT_RANK[c.icp_fit] >= FIT_RANK.HIGH)
      .sort((a, b) => FIT_RANK[b.icp_fit] - FIT_RANK[a.icp_fit])
      .slice(0, 20);
  }, [companies]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    const dbUpdates: Record<string, unknown> = { ...updates };
    delete dbUpdates.contacts;
    delete dbUpdates.created_at;
    await supabase.from("companies").update(dbUpdates as never).eq("id", id);
  }, []);

  const setStatus = useCallback(async (id: string, status: CompanyStatus, reason?: string) => {
    let prevStatus: CompanyStatus | undefined;
    let companyName = "";
    let sdr: Sdr | null = null;
    setCompanies((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      prevStatus = c.status;
      companyName = c.company_name;
      sdr = c.sdr ?? null;
      return {
        ...c,
        status,
        unqualified_reason: status === "unqualified" ? reason ?? c.unqualified_reason ?? "" : undefined,
      };
    }));
    await supabase.from("companies").update({
      status,
      unqualified_reason: status === "unqualified" ? (reason ?? "") : null,
    }).eq("id", id);
    // If moving away from "agendado", remove any scheduled meetings for this company
    if (prevStatus === "agendado" && status !== "agendado") {
      setMeetings((prev) => prev.filter((m) => m.company_id !== id));
      await supabase.from("meetings").delete().eq("company_id", id);
    }
    if (prevStatus && prevStatus !== status) {
      await logActivity({ type: "status_change", company_id: id, company_name: companyName, sdr, from_status: prevStatus, to_status: status });
    }
  }, [logActivity]);

  const scheduleMeeting = useCallback(async (
    companyId: string,
    payload: {
      scheduledAt: number;
      accountExecutive: AccountExecutive;
      notes?: string;
      aeEmail?: string;
      contactEmails?: string[];
      skipCalendar?: boolean;
    }
  ) => {
    let companyName = "";
    let sdr: Sdr | null = null;
    let prevStatus: CompanyStatus | undefined;
    setCompanies((prev) => prev.map((c) => {
      if (c.id !== companyId) return c;
      companyName = c.company_name;
      sdr = c.sdr ?? null;
      prevStatus = c.status;
      return { ...c, status: "agendado" as CompanyStatus };
    }));
    const d = new Date(payload.scheduledAt);
    const { year, week } = getIsoWeek(d);
    const endsAt = new Date(d.getTime() + 30 * 60_000);
    const sequence_id = getActiveSequenceId(companyId);
    const { data, error } = await supabase.from("meetings").insert({
      company_id: companyId,
      company_name: companyName,
      account_executive: payload.accountExecutive,
      sdr,
      scheduled_at: d.toISOString(),
      meeting_ends_at: endsAt.toISOString(),
      iso_year: year,
      iso_week: week,
      notes: payload.notes ?? "",
      sequence_id,
    }).select().single();
    if (!error && data) {
      const m = mapMeeting(data as MeetingRow);
      setMeetings((prev) => [m, ...prev]);
      // Fire Google Calendar event creation (best-effort), unless skipped
      if (!payload.skipCalendar) try {
        const { data: cal, error: calErr } = await supabase.functions.invoke("create-calendar-event", {
          body: {
            summary: `Discovery call ${companyName} x Colombia Tech Week`,
            description: payload.notes ?? "",
            scheduled_at: d.toISOString(),
            duration_minutes: 30,
            ae_email: payload.aeEmail ?? "",
            contact_emails: payload.contactEmails ?? [],
          },
        });
        if (!calErr && cal?.event_id) {
          await supabase
            .from("meetings")
            .update({ gcal_event_id: cal.event_id, meet_link: cal.meet_link })
            .eq("id", data.id);
          setMeetings((prev) =>
            prev.map((mm) =>
              mm.id === data.id ? { ...mm, gcal_event_id: cal.event_id, meet_link: cal.meet_link } : mm
            )
          );
        } else if (calErr) {
          console.error("create-calendar-event error", calErr);
        }
      } catch (e) {
        console.error("create-calendar-event invoke failed", e);
      }
    }
    await supabase.from("companies").update({ status: "agendado" }).eq("id", companyId);
    if (prevStatus && prevStatus !== "agendado") {
      await logActivity({ type: "status_change", company_id: companyId, company_name: companyName, sdr, from_status: prevStatus, to_status: "agendado" });
    }
    return data?.id as string | undefined;
  }, [logActivity, getActiveSequenceId]);

  const setMeetingGoal = useCallback(async (year: number, week: number, ae: AccountExecutive, goal: number) => {
    const existing = meetingGoals.find((g) => g.iso_year === year && g.iso_week === week && g.account_executive === ae);
    if (existing) {
      setMeetingGoals((prev) => prev.map((g) => g.id === existing.id ? { ...g, goal } : g));
      await supabase.from("meeting_goals").update({ goal }).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("meeting_goals").insert({
        iso_year: year, iso_week: week, account_executive: ae, goal,
      }).select().single();
      if (data) setMeetingGoals((prev) => [...prev, mapGoal(data as GoalRow)]);
    }
  }, [meetingGoals]);

  const setMeetingOutcome = useCallback(async (
    meetingId: string,
    outcome: "qualified" | "unqualified" | "no_show",
    reason?: string,
  ) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    if (outcome === "no_show") {
      // Remove meeting and put company back to "reagendar"
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      await supabase.from("meetings").delete().eq("id", meetingId);
      setCompanies((prev) => prev.map((c) =>
        c.id === meeting.company_id ? { ...c, status: "reagendar" as CompanyStatus } : c
      ));
      await supabase.from("companies").update({ status: "reagendar" }).eq("id", meeting.company_id);
      await supabase.from("activities").insert({
        type: "meeting_outcome",
        company_id: meeting.company_id,
        company_name: meeting.company_name,
        sdr: meeting.sdr,
        to_status: "no_show",
        sequence_id: getActiveSequenceId(meeting.company_id),
      });
      return;
    }

    if (outcome === "unqualified") {
      const r = (reason ?? "").trim();
      if (!r) return;
      setMeetings((prev) => prev.map((m) =>
        m.id === meetingId ? { ...m, outcome: "unqualified", outcome_reason: r } : m
      ));
      await supabase.from("meetings").update({ outcome: "unqualified", outcome_reason: r }).eq("id", meetingId);
      setCompanies((prev) => prev.map((c) =>
        c.id === meeting.company_id
          ? { ...c, status: "unqualified_post_meeting" as CompanyStatus, unqualified_reason: r }
          : c
      ));
      await supabase
        .from("companies")
        .update({ status: "unqualified_post_meeting", unqualified_reason: r })
        .eq("id", meeting.company_id);
      await supabase.from("activities").insert({
        type: "meeting_outcome",
        company_id: meeting.company_id,
        company_name: meeting.company_name,
        sdr: meeting.sdr,
        to_status: "unqualified",
        sequence_id: getActiveSequenceId(meeting.company_id),
      });
      return;
    }

    // qualified
    setMeetings((prev) => prev.map((m) =>
      m.id === meetingId ? { ...m, outcome: "qualified" } : m
    ));
    await supabase.from("meetings").update({ outcome: "qualified" }).eq("id", meetingId);
    await supabase.from("activities").insert({
      type: "meeting_outcome",
      company_id: meeting.company_id,
      company_name: meeting.company_name,
      sdr: meeting.sdr,
      to_status: "qualified",
      sequence_id: getActiveSequenceId(meeting.company_id),
    });
  }, [meetings, getActiveSequenceId]);

  const setSdr = useCallback(async (id: string, sdr: Sdr | null) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, sdr } : c)));
    await supabase.from("companies").update({ sdr }).eq("id", id);
  }, []);

  const setFit = useCallback(async (id: string, fit: IcpFit) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, icp_fit: fit } : c)));
    await supabase.from("companies").update({ icp_fit: fit }).eq("id", id);
  }, []);

  const setAmigos = useCallback(async (id: string, amigos: boolean, note?: string) => {
    let newNotes = "";
    setCompanies((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      let notes = c.notes;
      if (amigos && note && note.trim()) {
        const stamp = new Date().toLocaleDateString();
        const entry = `[${stamp}] Amigos: ${note.trim()}`;
        notes = notes ? `${notes}\n${entry}` : entry;
      }
      newNotes = notes;
      return { ...c, amigos, notes };
    }));
    await supabase.from("companies").update({ amigos, notes: newNotes }).eq("id", id);
  }, []);

  const addContact = useCallback(async (companyId: string, contact: Contact) => {
    setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, contacts: [...c.contacts, contact] } : c));
    const target = companies.find((c) => c.id === companyId);
    if (contact.linkedin) {
      try {
        const { data, error } = await supabase.functions.invoke("aimfox-relay", {
          body: {
            linkedin: contact.linkedin,
            nombre: contact.name,
            cargo: contact.role,
            email: contact.email ?? "",
            telefono: contact.phone ?? "",
          },
        });
        if (error || data?.ok === false) {
          console.warn("Webhook aimfox-contact failed", error ?? data);
        }
      } catch (e) {
        console.warn("Webhook aimfox-contact failed", e);
      }
    }
    await supabase.from("contacts").insert({
      company_id: companyId,
      name: contact.name,
      role: contact.role,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      linkedin: contact.linkedin,
      contacted_from: (contact.contacted_from && contact.contacted_from.length ? contact.contacted_from : null) as never,
    });
    if (target) {
      await logActivity({ type: "contact_added", company_id: companyId, company_name: target.company_name, sdr: target.sdr ?? null, contact_name: contact.name });
    }
  }, [companies, logActivity]);

  const removeContact = useCallback(async (companyId: string, linkedin: string) => {
    // Look up the contact name before removing it so we can also remove the
    // matching "contact_added" activities (otherwise the dashboard keeps
    // counting a contact that was added and then deleted).
    let removedName: string | null = null;
    setCompanies((prev) => prev.map((c) => {
      if (c.id !== companyId) return c;
      const target = c.contacts.find((k) => k.linkedin === linkedin);
      if (target) removedName = target.name;
      return { ...c, contacts: c.contacts.filter((k) => k.linkedin !== linkedin) };
    }));
    if (removedName) {
      setActivities((prev) => prev.filter((a) => !(
        a.company_id === companyId &&
        a.type === "contact_added" &&
        a.contact_name === removedName
      )));
    }
    const ops: PromiseLike<unknown>[] = [
      supabase.from("contacts").delete().eq("company_id", companyId).eq("linkedin", linkedin),
    ];
    if (removedName) {
      ops.push(
        supabase.from("activities").delete()
          .eq("company_id", companyId)
          .eq("type", "contact_added")
          .eq("contact_name", removedName)
      );
    }
    await Promise.all(ops);
  }, []);

  const updateContact = useCallback(async (companyId: string, oldLinkedin: string, updates: Partial<Contact>) => {
    let target: Company | undefined;
    let isNewContactName = false;
    setCompanies((prev) => prev.map((c) => {
      if (c.id !== companyId) return c;
      target = c;
      const prevContact = c.contacts.find((k) => k.linkedin === oldLinkedin);
      // Treat as "new contact" activity only when the name was actually edited.
      isNewContactName = !!(updates.name && prevContact && updates.name !== prevContact.name);
      return {
        ...c,
        contacts: c.contacts.map((k) => k.linkedin === oldLinkedin ? { ...k, ...updates } : k),
      };
    }));
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.email !== undefined) dbUpdates.email = updates.email ?? null;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone ?? null;
    if (updates.linkedin !== undefined) dbUpdates.linkedin = updates.linkedin;
    if (updates.contacted_from !== undefined) dbUpdates.contacted_from = updates.contacted_from && updates.contacted_from.length ? updates.contacted_from : null;
    await supabase.from("contacts").update(dbUpdates as never).eq("company_id", companyId).eq("linkedin", oldLinkedin);
    if (isNewContactName && target) {
      const name = updates.name ?? "";
      await logActivity({ type: "contact_added", company_id: companyId, company_name: target!.company_name, sdr: target.sdr ?? null, contact_name: name });
    }
  }, [logActivity]);

  const deleteMeeting = useCallback(async (meetingId: string) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    if (meeting.gcal_event_id) {
      try {
        await supabase.functions.invoke("delete-calendar-event", {
          body: { event_id: meeting.gcal_event_id },
        });
      } catch (e) {
        console.error("delete-calendar-event invoke failed", e);
      }
    }
    await supabase.from("meetings").delete().eq("id", meetingId);
  }, [meetings]);

  const updateMeetingSchedule = useCallback(async (meetingId: string, newScheduledAt: number) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    const d = new Date(newScheduledAt);
    const { year, week } = getIsoWeek(d);
    const endsAt = new Date(d.getTime() + 30 * 60_000);
    setMeetings((prev) => prev.map((m) =>
      m.id === meetingId ? { ...m, scheduled_at: newScheduledAt, iso_year: year, iso_week: week } : m
    ));
    await supabase.from("meetings").update({
      scheduled_at: d.toISOString(),
      meeting_ends_at: endsAt.toISOString(),
      iso_year: year,
      iso_week: week,
    }).eq("id", meetingId);
    if (meeting.gcal_event_id) {
      try {
        await supabase.functions.invoke("update-calendar-event", {
          body: { event_id: meeting.gcal_event_id, scheduled_at: d.toISOString(), duration_minutes: 30 },
        });
      } catch (e) {
        console.error("update-calendar-event invoke failed", e);
      }
    }
  }, [meetings]);

  const markAsReviewed = useCallback(async (ids: string[]) => {
    setCompanies((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, reviewed: true } : c));
    await supabase.from("companies").update({ reviewed: true }).in("id", ids);
  }, []);

  const updateMeetingAssignment = useCallback(async (
    meetingId: string,
    patch: { account_executive?: AccountExecutive; sdr?: Sdr | null }
  ) => {
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, ...patch } : m)));
    const dbPatch: { account_executive?: string; sdr?: string | null } = {};
    if (patch.account_executive !== undefined) dbPatch.account_executive = patch.account_executive;
    if (patch.sdr !== undefined) dbPatch.sdr = patch.sdr;
    await supabase.from("meetings").update(dbPatch).eq("id", meetingId);
    // Si cambió el AE de la reunión, propagamos al deal asociado (si existe) para que las
    // tarjetas de "Pipe Ingresado por AE" reflejen el cambio inmediatamente.
    if (patch.account_executive !== undefined) {
      await supabase
        .from("deals")
        .update({ account_executive: patch.account_executive })
        .eq("meeting_id", meetingId);
    }
    if (patch.sdr !== undefined) {
      await supabase
        .from("deals")
        .update({ sdr: patch.sdr })
        .eq("meeting_id", meetingId);
    }
  }, []);

  const deleteCompanies = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setCompanies((prev) => prev.filter((c) => !ids.includes(c.id)));
    setTasks((prev) => prev.filter((t) => !ids.includes(t.company_id)));
    await supabase.from("contacts").delete().in("company_id", ids);
    await supabase.from("tasks").delete().in("company_id", ids);
    await supabase.from("activities").delete().in("company_id", ids);
    await supabase.from("companies").delete().in("id", ids);
  }, []);

  const addCompanies = useCallback(async (newCompanies: Company[]) => {
    if (newCompanies.length === 0) return;
    const payload = newCompanies.map((c) => companyToInsert(c));
    const { data, error } = await supabase.from("companies").insert(payload).select();
    if (error) { console.error(error); return; }
    // Insert contacts for each company
    const contactPayload: Array<{ company_id: string; name: string; role: string; email: string | null; phone: string | null; linkedin: string }> = [];
    (data ?? []).forEach((row, idx) => {
      const src = newCompanies[idx];
      src.contacts.forEach((k) => contactPayload.push({
        company_id: row.id, name: k.name, role: k.role, email: k.email ?? null, phone: k.phone ?? null, linkedin: k.linkedin,
      }));
    });
    if (contactPayload.length > 0) {
      await supabase.from("contacts").insert(contactPayload);
    }
    // Optimistically merge so UI updates immediately even before realtime fires
    const inserted: Company[] = (data ?? []).map((row, idx) => mapCompany(row as CompanyRow, newCompanies[idx].contacts));
    setCompanies((prev) => {
      const existing = new Set(prev.map((c) => c.id));
      return [...inserted.filter((c) => !existing.has(c.id)), ...prev];
    });
  }, []);

  const mergeCompanies = useCallback(async (primaryId: string, otherIds: string[]) => {
    if (otherIds.length === 0) return;
    const primary = companiesRef.current.find((c) => c.id === primaryId);
    if (!primary) throw new Error("No se encontró la empresa principal para fusionar.");
    const others = companiesRef.current.filter((c) => otherIds.includes(c.id));
    if (others.length === 0) return;
    const snapshot = companiesRef.current;
    const merged = mergeCompanyData(primary, others);

    setCompanies((prev) => {
      return prev
        .filter((c) => !otherIds.includes(c.id))
        .map((c) => (c.id === primaryId ? merged : c));
    });
    const m = merged as Company;
    try {
      // Reassign child rows from secondaries to primary
      const reassignResults = await Promise.all([
        supabase.from("contacts").update({ company_id: primaryId }).in("company_id", otherIds),
        supabase.from("tasks").update({ company_id: primaryId }).in("company_id", otherIds),
        supabase.from("activities").update({ company_id: primaryId }).in("company_id", otherIds),
        supabase.from("deals").update({ company_id: primaryId }).in("company_id", otherIds),
        supabase.from("meetings").update({ company_id: primaryId }).in("company_id", otherIds),
        supabase.from("prospection_sequences").update({ company_id: primaryId }).in("company_id", otherIds),
      ]);
      for (const r of reassignResults) {
        if (r.error) {
          console.error("merge reassign failed", r.error);
          throw r.error;
        }
      }
      // Update primary fields before deleting secondaries
      const updateRes = await supabase.from("companies").update({
        company_name: m.company_name,
        domain: m.domain,
        industry: m.industry,
        size: m.size,
        country: m.country,
        linkedin_url: m.linkedin_url,
        icp_fit: m.icp_fit,
        reasoning: m.reasoning,
        angle: m.angle,
        sdr: m.sdr ?? null,
        amigos: m.amigos ?? false,
        reviewed: m.reviewed,
        notes: m.notes,
      }).eq("id", primaryId);
      if (updateRes.error) {
        console.error("merge primary update failed", updateRes.error);
        throw updateRes.error;
      }

      // Delete secondaries
      const delRes = await supabase.from("companies").delete().in("id", otherIds);
      if (delRes.error) {
        console.error("merge delete failed", delRes.error);
        throw delRes.error;
      }
      // Deduplicate contact rows by linkedin (DB-side) — simple approach: delete duplicates keeping any single row per (company_id, linkedin)
      const { data: kRows, error: contactReadError } = await supabase.from("contacts").select("id, linkedin").eq("company_id", primaryId);
      if (contactReadError) throw contactReadError;
      if (kRows) {
        const seen = new Set<string>();
        const dupIds: string[] = [];
        for (const r of kRows as Array<{ id: string; linkedin: string }>) {
          const key = (r.linkedin ?? "").toLowerCase();
          if (seen.has(key)) dupIds.push(r.id);
          else seen.add(key);
        }
        if (dupIds.length > 0) {
          const contactDeleteRes = await supabase.from("contacts").delete().in("id", dupIds);
          if (contactDeleteRes.error) throw contactDeleteRes.error;
        }
      }
    } catch (error) {
      setCompanies(snapshot);
      throw error;
    }
  }, []);

  const duplicateClusters = useMemo(() => findDuplicateClusters(companies), [companies]);

  const addTask = useCallback(async (companyId: string, title: string, dueAt: number) => {
    const target = companies.find((c) => c.id === companyId);
    if (!target) return;
    const { data, error } = await supabase.from("tasks").insert({
      company_id: companyId,
      company_name: target.company_name,
      sdr: target.sdr ?? null,
      title,
      due_at: new Date(dueAt).toISOString(),
      completed: false,
    }).select().single();
    if (error || !data) { console.error(error); return; }
    const t = mapTask(data as TaskRow);
    setTasks((prev) => prev.some((x) => x.id === t.id) ? prev : [...prev, t]);
  }, [companies]);

  const toggleTask = useCallback(async (id: string) => {
    let next = false;
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      next = !t.completed;
      return { ...t, completed: next };
    }));
    await supabase.from("tasks").update({ completed: next }).eq("id", id);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }, []);

  const reassignCompany = useCallback(async (
    companyId: string,
    payload: { sdr: Sdr | null; linkedinAccount: ContactedFrom | null }
  ) => {
    // 1. Close active sequence
    const active = sequencesRef.current
      .filter((s) => s.company_id === companyId && s.ended_at === null)
      .sort((a, b) => b.started_at - a.started_at)[0];
    if (active) {
      const endedAt = new Date().toISOString();
      setSequences((prev) => prev.map((s) =>
        s.id === active.id ? { ...s, ended_at: Date.now(), end_reason: "reasignado" } : s
      ));
      await supabase
        .from("prospection_sequences")
        .update({ ended_at: endedAt, end_reason: "reasignado" })
        .eq("id", active.id);
    }
    // 2. Insert new sequence (and update ref synchronously so the activity below picks it up)
    const { data, error } = await supabase.from("prospection_sequences").insert({
      company_id: companyId,
      sdr: payload.sdr,
      linkedin_account: payload.linkedinAccount,
    }).select().single();
    if (error || !data) { console.error(error); return; }
    const newSeq = mapSequence(data as SequenceRow);
    sequencesRef.current = [...sequencesRef.current, newSeq];
    setSequences((prev) => prev.some((s) => s.id === newSeq.id) ? prev : [...prev, newSeq]);

    // 3. Update company: new SDR + back to "por_contactar"
    let companyName = "";
    let prevStatus: CompanyStatus | undefined;
    setCompanies((prev) => prev.map((c) => {
      if (c.id !== companyId) return c;
      companyName = c.company_name;
      prevStatus = c.status;
      return { ...c, sdr: payload.sdr, status: "por_contactar" as CompanyStatus };
    }));
    await supabase.from("companies").update({
      sdr: payload.sdr,
      status: "por_contactar",
    }).eq("id", companyId);

    // 4. Log status change attributed to new SDR + new sequence
    if (prevStatus && prevStatus !== "por_contactar") {
      await logActivity({
        type: "status_change",
        company_id: companyId,
        company_name: companyName,
        sdr: payload.sdr,
        from_status: prevStatus,
        to_status: "por_contactar",
      });
    }
  }, [logActivity]);

  return {
    companies: filteredCompanies,
    allCompanies: companies,
    topRecommended,
    filters,
    setFilters,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    updateCompany,
    setStatus,
    setSdr,
    setFit,
    setAmigos,
    addContact,
    removeContact,
    markAsReviewed,
    deleteCompanies,
    addCompanies,
    mergeCompanies,
    duplicateClusters,
    countries,
    industries,
    activities,
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    meetings,
    meetingGoals,
    scheduleMeeting,
    setMeetingGoal,
    setMeetingOutcome,
    deleteMeeting,
    updateMeetingSchedule,
    updateMeetingAssignment,
    updateContact,
    sequences,
    reassignCompany,
  };
}

type Ctx = ReturnType<typeof useCompanyDataInternal>;
const CompanyDataContext = createContext<Ctx | null>(null);

export function CompanyDataProvider({ children }: { children: ReactNode }) {
  const value = useCompanyDataInternal();
  return createElement(CompanyDataContext.Provider, { value }, children);
}

export function useCompanyData() {
  const ctx = useContext(CompanyDataContext);
  if (!ctx) throw new Error("useCompanyData must be used within CompanyDataProvider");
  return ctx;
}
