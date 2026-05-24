import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";

export interface Player {
  id: string;
  name: string;
  created_at?: string;
  attended: boolean;
  paid: boolean;
  session_id?: number;
}

export interface Session {
  id: number;
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
  session_id?: number;
};

type ConfigRow = {
  id: number;
  session_title: string;
  session_time: string;
  max_slots: number;
  session_date?: string;
};

const PLAYER_COLUMNS = "id, name, created_at, attended, paid, session_id";

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

function statusErrorMessage(field: "attended" | "paid", error: unknown): string {
  const detail =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: string }).message)
      : "";

  if (field === "paid") {
    return (
      "Không lưu được trạng thái CK.\n\n" +
      "Chạy supabase/fix_players_paid_persist.sql trong Supabase SQL Editor.\n\n" +
      (detail ? `Chi tiết: ${detail}` : "")
    );
  }

  return `Không lưu được điểm danh.${detail ? `\n\nChi tiết: ${detail}` : ""}`;
}

function readSessionIdFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get("buoi");
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function writeSessionIdToUrl(sessionId: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("buoi", String(sessionId));
  window.history.replaceState({}, "", url.toString());
}

export function useBadmintonData() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    readSessionIdFromUrl
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const activeSessionIdRef = useRef<number | null>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;

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

  const fetchSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from("config")
      .select("id, session_title, session_time, max_slots, session_date")
      .order("id", { ascending: true });

    if (error) {
      console.error("fetchSessions:", error);
      return [];
    }

    const list = (data as ConfigRow[]).map(mapSession);
    setSessions(list);
    return list;
  }, []);

  const fetchPlayers = useCallback(async (sessionId: number | null) => {
    if (!sessionId) {
      setPlayers([]);
      return;
    }

    let query = supabase
      .from("players")
      .select(PLAYER_COLUMNS)
      .order("created_at", { ascending: true });

    query = query.eq("session_id", sessionId);

    const { data, error } = await query;

    if (error) {
      console.error("fetchPlayers:", error);
      if (error.message?.includes("session_id")) {
        const fallback = await supabase
          .from("players")
          .select(PLAYER_COLUMNS)
          .order("created_at", { ascending: true });
        if (!fallback.error) {
          setPlayers((fallback.data as PlayerRow[] | null)?.map(mapPlayer) ?? []);
        }
        return;
      }
      if (
        error.message?.includes("attended") ||
        error.message?.includes("paid")
      ) {
        alert(
          "Bảng players thiếu cột attended/paid.\nChạy supabase/fix_players_paid_persist.sql trong Supabase SQL Editor."
        );
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
        urlId && list.some((s) => s.id === urlId)
          ? urlId
          : list[0]?.id ?? null;

      setActiveSessionId(initialId);
      if (initialId) writeSessionIdToUrl(initialId);
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
          if (sid) fetchPlayers(sid);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "config" },
        async () => {
          await fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSessions, fetchPlayers]);

  useEffect(() => {
    if (loading || !activeSessionId) return;

    const load = async () => {
      setPlayersLoading(true);
      writeSessionIdToUrl(activeSessionId);
      await fetchPlayers(activeSessionId);
      setPlayersLoading(false);
    };

    load();
  }, [activeSessionId, loading, fetchPlayers]);

  const selectSession = (sessionId: number) => {
    setActiveSessionId(sessionId);
  };

  const addPlayer = async (name: string) => {
    if (!activeSessionId) return;

    const row: { name: string; session_id: number } = {
      name,
      session_id: activeSessionId,
    };

    const { error } = await supabase.from("players").insert([row]);

    if (error) {
      console.error(error);
      const fallback = await supabase.from("players").insert([{ name }]);
      if (fallback.error) {
        alert("Không thêm được thành viên. Thử lại sau.");
        return;
      }
    }

    await fetchPlayers(activeSessionId);
  };

  const removePlayer = async (id: string) => {
    const { error } = await supabase.from("players").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    if (activeSessionId) await fetchPlayers(activeSessionId);
  };

  const resetPlayers = async () => {
    if (!activeSessionId) return;

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
  }) => {
    if (!activeSessionId) return;

    const { error } = await supabase
      .from("config")
      .update({
        session_title: newConfig.sessionTitle,
        session_time: newConfig.sessionTime,
        max_slots: newConfig.maxSlots,
      })
      .eq("id", activeSessionId);

    if (error) {
      console.error(error);
      alert("Không cập nhật được buổi tập.");
      return;
    }

    await fetchSessions();
  };

  const createSession = async () => {
    const today = new Date();
    const label = today.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });

    const { data, error } = await supabase
      .from("config")
      .insert({
        session_title: `Buổi ${label}`,
        session_time: "08:00 - 10:00",
        max_slots: 12,
        session_date: today.toISOString().slice(0, 10),
      })
      .select("id, session_title, session_time, max_slots, session_date")
      .single();

    if (error) {
      console.error(error);
      alert(
        "Không tạo buổi mới.\nChạy supabase/multi_sessions.sql trong Supabase SQL Editor."
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

  const deleteSession = async (sessionId: number) => {
    if (sessions.length <= 1) {
      alert("Phải giữ ít nhất một buổi vote.");
      return false;
    }

    const { error } = await supabase.from("config").delete().eq("id", sessionId);

    if (error) {
      console.error(error);
      alert("Không xóa được buổi này.");
      return false;
    }

    const list = await fetchSessions();
    const nextId = list[0]?.id ?? null;
    setActiveSessionId(nextId);
    if (nextId) {
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
  ) => {
    const { data, error } = await supabase
      .from("players")
      .update({ [field]: value })
      .eq("id", id)
      .select(PLAYER_COLUMNS)
      .maybeSingle();

    if (error || !data) {
      console.error("updatePlayerStatus:", error ?? "no row returned");
      alert(statusErrorMessage(field, error));
      if (activeSessionId) await fetchPlayers(activeSessionId);
      return;
    }

    const updated = mapPlayer(data as PlayerRow);
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)));
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
}
