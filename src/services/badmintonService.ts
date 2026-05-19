import { useState, useEffect } from 'react';

// Types
export interface Player {
  id: string;
  name: string;
  timestamp: number;
}

export interface AppConfig {
  sessionTitle: string;
  sessionTime: string;
  maxSlots: number;
}

// Fallback logic for LocalStorage when Firebase is not connected
const STORAGE_KEY_PLAYERS = 'badminton_players';
const STORAGE_KEY_CONFIG = 'badminton_config';

const getLocalPlayers = (): Player[] => {
  const saved = localStorage.getItem(STORAGE_KEY_PLAYERS);
  return saved ? JSON.parse(saved) : [];
};

const getLocalConfig = (): AppConfig => {
  const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
  return saved ? JSON.parse(saved) : {
    sessionTitle: "Buổi tập cầu lông",
    sessionTime: "08:00 - 10:00",
    maxSlots: 12
  };
};

const saveLocalPlayers = (players: Player[]) => {
  localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
  window.dispatchEvent(new Event('storage_update'));
};

const saveLocalConfig = (config: AppConfig) => {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  window.dispatchEvent(new Event('storage_update'));
};

// Hook for Realtime Data
// In a real Firebase app, this would use onSnapshot.
// For the static version without provisioning, we simulate it with LocalStorage events.
export function useBadmintonData() {
  const [players, setPlayers] = useState<Player[]>(getLocalPlayers());
  const [config, setConfig] = useState<AppConfig>(getLocalConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUpdate = () => {
      setPlayers(getLocalPlayers());
      setConfig(getLocalConfig());
    };

    window.addEventListener('storage_update', handleUpdate);
    setLoading(false);

    return () => window.removeEventListener('storage_update', handleUpdate);
  }, []);

  const addPlayer = (name: string) => {
    const current = getLocalPlayers();
    const newPlayer: Player = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      timestamp: Date.now()
    };
    saveLocalPlayers([...current, newPlayer]);
  };

  const removePlayer = (id: string) => {
    const current = getLocalPlayers();
    saveLocalPlayers(current.filter(p => p.id !== id));
  };

  const resetPlayers = () => {
    saveLocalPlayers([]);
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    const current = getLocalConfig();
    saveLocalConfig({ ...current, ...newConfig });
  };

  return { players, config, loading, addPlayer, removePlayer, resetPlayers, updateConfig };
}

/**
 * Note for Developers:
 * To enable real-time synchronization across different devices, 
 * you must accept the Firebase setup in AI Studio.
 * This will provision a Firestore database and provide an API key.
 * Once provisioned, you can replace the LocalStorage implementation 
 * below with the Firebase SDK logic.
 */
