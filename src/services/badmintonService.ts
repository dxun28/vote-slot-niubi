import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";

export type SessionId = number | string;

export interface Player {
  id: string;
  name: string;
  created_at?: string;
  attended: boolean;
  paid: boolean;
  session_id?: SessionId;
}

export interface Session {
  id: SessionId;
  sessionTitle: string;
  sessionTime: string;
  maxSlots: number;
  sessionDate?: string;
}

type PlayerRow = {
  id: string;
  name: string;
  created_at?: string;
  attended?: boolean;
  paid?: boolean;
  session_id?: SessionId;
};

type ConfigRow = {
  id: SessionId;
  session_title: string;
  session_time: string;
  max_slots: number;
  session_date?: string;
};

const PLAYER_SELECT =
  "id, name, created_at, attended, paid, session_id";
const CONFIG_SELECT = "id, session_title, session_time, max_slots";
const CONFIG_SELECT_FULL = `${CONFIG_SELECT}, session_date`;

function supabaseErr(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return "Lỗi không xác định";
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    attended: Boolean(row.attended),
    paid: Boolean(row.paid),
    session_id: row.session_id,
  };
}

function mapSession(row: ConfigRow): Session {
  return {
    id: row.id,
    sessionTitle: row.session_title,
    sessionTime: row.session_time,
    maxSlots: row.max_slots,
    sessionDate: row.session_date,
  };
}

function readSessionIdFromUrl(): SessionId | null {
  const raw = new URLSearchParams(window.location.search).get("buoi");
  if (!raw) return null;
  const asNum = Number(raw);
  return Number.isFinite(asNum) && String(asNum) === raw ? asNum : raw;
}

function writeSessionIdToUrl(sessionId: SessionId) {
  const url = new URL(window.location.href);
  url.searchParams.set("buoi", String(sessionId));
  window.history.replaceState({}, "", url.toString());
}

function sameSessionId(a: SessionId | null, b: SessionId): boolean {
  return a !== null && String(a) === String(b);
}

const SQL_HINT =
  "\n\n→ Vào Supabase → SQL Editor → chạy file supabase/setup_all.sql";

export function useBadmintonData() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<SessionId | null>(
    readSessionIdFromUrl
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const activeSessionIdRef = useRef<SessionId | null>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const activeSession =
    sessions.find((s) => sameSessionId(activeSessionId, s.id)) ??
    sessions[0] ??
    null;

  const config = activeSession
    ? {
        sessionTitle: activeSession.sessionTitle,
        sessionTime: activeSession.sessionTime,
        maxSlots: activeSession.maxSlots,
      }
    : {
        sessionTitle: "Buổi tập cầu lông",
        sessionTime: "08:00 - 10:00",
        maxSlots: 12,
      };

  const fetchSessions = useCallback(async (): Promise<Session[]> => {
    let { data, error } = await supabase
      .from("config")
      .select(CONFIG_SELECT_FULL)
      .order("id", { ascending: true });

    if (error) {
      const retry = await supabase
        .from("config")
        .select(CONFIG_SELECT)
        .order("id", { ascending: true });
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error) {
      console.error("fetchSessions:", error);
      alert(`Không tải danh sách buổi tập.${SQL_HINT}\n\n${supabaseErr(error)}`);
      return [];
    }

    const list = (data as ConfigRow[]).map(mapSession);
    setSessions(list);
    return list;
  }, []);

  const fetchPlayers = useCallback(async (sessionId: SessionId | null) => {
    if (sessionId === null) {
      setPlayers([]);
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("fetchPlayers:", error);
      if (String(error.message).includes("session_id")) {
        const fallback = await supabase
          .from("players")
          .select("id, name, created_at, attended, paid")
          .order("created_at", { ascending: true });
        if (!fallback.error) {
          setPlayers(
            (fallback.data as PlayerRow[] | null)?.map(mapPlayer) ?? []
          );
        }
        return;
      }
      return;
    }

    setPlayers((data as PlayerRow[] | null)?.map(mapPlayer) ?? []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const list = await fetchSessions();
      const urlId = readSessionIdFromUrl();
      const initialId =
        urlId !== null && list.some((s) => sameSessionId(urlId, s.id))
          ? urlId
          : list[0]?.id ?? null;

      setActiveSessionId(initialId);
      if (initialId !== null) writeSessionIdToUrl(initialId);
      setLoading(false);
    };

    init();

    const channel = supabase
      .channel("realtime-badminton")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => {
          const sid = activeSessionIdRef.current;
          if (sid !== null) fetchPlayers(sid);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "config" },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSessions, fetchPlayers]);

  useEffect(() => {
    if (loading || activeSessionId === null) return;

    const load = async () => {
      setPlayersLoading(true);
      writeSessionIdToUrl(activeSessionId);
      await fetchPlayers(activeSessionId);
      setPlayersLoading(false);
    };

    load();
  }, [activeSessionId, loading, fetchPlayers]);

  const selectSession = (sessionId: SessionId) => {
    setActiveSessionId(sessionId);
  };

  const addPlayer = async (name: string) => {
    if (activeSessionId === null) return false;

    const { error } = await supabase.from("players").insert([
      { name, session_id: activeSessionId },
    ]);

    if (error) {
      const fallback = await supabase.from("players").insert([{ name }]);
      if (fallback.error) {
        alert(`Không thêm được thành viên.\n${supabaseErr(fallback.error)}`);
        return false;
      }
    }

    await fetchPlayers(activeSessionId);
    return true;
  };

  const removePlayer = async (id: string) => {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    if (activeSessionId !== null) await fetchPlayers(activeSessionId);
  };

  const resetPlayers = async () => {
    if (activeSessionId === null) return;

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("session_id", activeSessionId);

    if (error) {
      const fallback = await supabase.from("players").delete().neq("id", "0");
      if (fallback.error) {
        console.error(fallback.error);
        return;
      }
    }

    await fetchPlayers(activeSessionId);
  };

  const updateConfig = async (newConfig: {
    sessionTitle: string;
    sessionTime: string;
    maxSlots: number;
  }): Promise<boolean> => {
    if (activeSessionId === null) return false;

    const payload = {
      session_title: newConfig.sessionTitle.trim(),
      session_time: newConfig.sessionTime.trim(),
      max_slots: newConfig.maxSlots,
    };

    const { data, error } = await supabase
      .from("config")
      .update(payload)
      .eq("id", activeSessionId)
      .select(CONFIG_SELECT)
      .maybeSingle();

    if (error || !data) {
      console.error("updateConfig:", error);
      alert(
        `Không lưu được cấu hình buổi tập.${SQL_HINT}\n\n${
          error ? supabaseErr(error) : "Không có dòng nào được cập nhật (RLS hoặc sai id)."
        }`
      );
      return false;
    }

    const updated = mapSession(data as ConfigRow);
    setSessions((prev) =>
      prev.map((s) => (sameSessionId(activeSessionId, s.id) ? updated : s))
    );
    return true;
  };

  const createSession = async (): Promise<Session | null> => {
    const today = new Date();
    const label = today.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });

    const base = {
      session_title: `Buổi ${label}`,
      session_time: "08:00 - 10:00",
      max_slots: 12,
    };

    let { data, error } = await supabase
      .from("config")
      .insert({ ...base, session_date: today.toISOString().slice(0, 10) })
      .select(CONFIG_SELECT_FULL)
      .single();

    if (error) {
      const retry = await supabase
        .from("config")
        .insert(base)
        .select(CONFIG_SELECT)
        .single();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error || !data) {
      console.error("createSession:", error);
      alert(
        `Không tạo buổi mới.${SQL_HINT}\n\n${supabaseErr(error ?? "Không trả về dữ liệu")}`
      );
      return null;
    }

    const session = mapSession(data as ConfigRow);
    await fetchSessions();
    setActiveSessionId(session.id);
    writeSessionIdToUrl(session.id);
    await fetchPlayers(session.id);
    return session;
  };

  const deleteSession = async (sessionId: SessionId) => {
    if (sessions.length <= 1) {
      alert("Phải giữ ít nhất một buổi vote.");
      return false;
    }

    const { error } = await supabase.from("config").delete().eq("id", sessionId);

    if (error) {
      alert(`Không xóa được buổi.\n${supabaseErr(error)}`);
      return false;
    }

    const list = await fetchSessions();
    const nextId = list[0]?.id ?? null;
    setActiveSessionId(nextId);
    if (nextId !== null) {
      writeSessionIdToUrl(nextId);
      await fetchPlayers(nextId);
    } else {
      setPlayers([]);
    }
    return true;
  };

  const updatePlayerStatus = async (
    id: string,
    field: "attended" | "paid",
    value: boolean
  ): Promise<boolean> => {
    const { data, error } = await supabase
      .from("players")
      .update({ [field]: value })
      .eq("id", id)
      .select("id, name, created_at, attended, paid")
      .maybeSingle();

    if (error || !data) {
      console.error("updatePlayerStatus:", error);
      const label = field === "paid" ? "CK" : "điểm danh";
      alert(
        `Không lưu được ${label}.${SQL_HINT}\n\n${
          error ? supabaseErr(error) : "Không có dòng nào được cập nhật."
        }`
      );
      if (activeSessionId !== null) await fetchPlayers(activeSessionId);
      return false;
    }

    const updated = mapPlayer(data as PlayerRow);
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return true;
  };

  return {
    sessions,
    activeSessionId,
    selectSession,
    config,
    players,
    loading,
    playersLoading,
    addPlayer,
    removePlayer,
    resetPlayers,
    updateConfig,
    updatePlayerStatus,
    createSession,
    deleteSession,
  };
};
