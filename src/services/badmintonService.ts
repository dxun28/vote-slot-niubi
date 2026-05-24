import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export interface Player {
  id: string;
  name: string;
  created_at?: string;
  attended: boolean;
  paid: boolean;
}

type PlayerRow = {
  id: string;
  name: string;
  created_at?: string;
  attended?: boolean;
  paid?: boolean;
};

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    attended: row.attended ?? false,
    paid: row.paid ?? false,
  };
}

export interface AppConfig {
  sessionTitle: string;
  sessionTime: string;
  maxSlots: number;
}

export function useBadmintonData() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    sessionTitle: "Buổi tập cầu lông",
    sessionTime: "08:00 - 10:00",
    maxSlots: 12
  });

  const [loading, setLoading] = useState(true);

  // FETCH DATA
 const fetchPlayers = async () => {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  setPlayers((data as PlayerRow[] | null)?.map(mapPlayer) ?? []);
};

const fetchConfig = async () => {
  const { data, error } = await supabase
    .from("config")
    .select("*")
    .eq("id", 1)   // 👈 QUAN TRỌNG
    .single();

  if (error) {
    console.error(error);
    return;
  }

  setConfig({
    sessionTitle: data.session_title,
    sessionTime: data.session_time,
    maxSlots: data.max_slots
  });
};
  // INIT + REALTIME
useEffect(() => {
  const init = async () => {
    await fetchPlayers();
    await fetchConfig();
    setLoading(false);
  };

  init();

    const channel = supabase
      .channel("realtime-badminton")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        fetchPlayers
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "config" },
        fetchConfig
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ADD PLAYER (🔥 QUAN TRỌNG)
  const addPlayer = async (name: string) => {
  const { error } = await supabase.from("players").insert([
    { name, attended: false, paid: false }
  ]);

  if (error) {
    console.error(error);
    return;
  }

  await fetchPlayers(); // 🔥 cực quan trọng
};
  // REMOVE
 const removePlayer = async (id: string) => {
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  await fetchPlayers(); // 👈 QUAN TRỌNG
};

  // RESET
  const resetPlayers = async () => {
  const { error } = await supabase
    .from("players")
    .delete()
    .neq("id", "0"); // xóa toàn bộ (hack chuẩn Supabase)

  if (error) {
    console.error(error);
    return;
  }

  await fetchPlayers(); // reload lại UI
};
  // UPDATE CONFIG
const updateConfig = async (newConfig: AppConfig) => {
  const { error } = await supabase
    .from("config")
    .update({
      session_title: newConfig.sessionTitle,
      session_time: newConfig.sessionTime,
      max_slots: newConfig.maxSlots,
    })
    .eq("id", 1); // 👈 QUAN TRỌNG

  if (error) {
    console.error(error);
    return;
  }

  await fetchConfig(); // 👈 FORCE REFRESH UI
};

  const updatePlayerStatus = async (
    id: string,
    field: "attended" | "paid",
    value: boolean
  ) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );

    const { error } = await supabase
      .from("players")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      console.error(error);
      await fetchPlayers();
      if (field === "paid") {
        alert("Không lưu được trạng thái chuyển khoản. Kiểm tra cột paid trên Supabase.");
      }
    }
  };

  return {
    players,
    config,
    loading,
    addPlayer,
    removePlayer,
    resetPlayers,
    updateConfig,
    updatePlayerStatus,
  };
}