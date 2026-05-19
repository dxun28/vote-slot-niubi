import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export interface Player {
  id: string;
  name: string;
  created_at?: string;
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

  setPlayers(data || []);
};

 const fetchConfig = async () => {
  const { data, error } = await supabase
    .from("config")
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return;
  }

  setConfig(data);
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
    { name }
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

    if (error) console.error(error);
  };

  // RESET
  const resetPlayers = async () => {
    const { error } = await supabase.from("players").delete().neq("id", "");

    if (error) console.error(error);
  };

  // UPDATE CONFIG
const updateConfig = async (newConfig) => {
  const { error } = await supabase
    .from("config")
    .update({
      session_title: newConfig.sessionTitle,
      session_time: newConfig.sessionTime,
      max_slots: newConfig.maxSlots,
    });

  if (error) console.error(error);

};

  return {
    players,
    config,
    loading,
    addPlayer,
    removePlayer,
    resetPlayers,
    updateConfig
  };
}