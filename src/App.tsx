import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Trash2, Shield, RotateCcw, Plus, CheckCircle2 } from "lucide-react";
import { useBadmintonData } from "./services/badmintonService";
import { supabase } from "./supabase"

export default function App() {
  const { players, config, loading, addPlayer, removePlayer, resetPlayers, updateConfig } = useBadmintonData();
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPwdInput, setShowPwdInput] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [adminError, setAdminError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'reset';
    id?: string;
    message: string;
  } | null>(null);
console.log("players:", players);
  // Admin input states which should be initialized with config
  const [editTitle, setEditTitle] = useState(config.sessionTitle);
  const [editTime, setEditTime] = useState(config.sessionTime);
  const [editMaxSlots, setEditMaxSlots] = useState(config.maxSlots);
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
  // Update local edit states when config changes
useEffect(() => {
  const init = async () => {
    await fetchPlayers();
    await fetchConfig();
    setLoading(false);
  };

  init();

  const channel = supabase
    .channel("badminton-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "players" },
      async () => {
        await fetchPlayers();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "config" },
      async () => {
        await fetchConfig();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    isMounted = false;
  };
}, []);

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    if (adminPwd === "xuan280604a") {
      setIsAdmin(true);
      setShowPwdInput(false);
      setAdminPwd("");
    } else {
      setAdminError("Mật khẩu không chính xác!");
    }
  };

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      setShowPwdInput(!showPwdInput);
    }
  };

  const handleUpdateConfig = () => {
    updateConfig({
      sessionTitle: editTitle,
      sessionTime: editTime,
      maxSlots: editMaxSlots
    });
    alert("Cập nhật thành công!");
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || players.length >= config.maxSlots) return;
    addPlayer(name);
    setName("");
  };

  const handleDelete = (id: string, name: string) => {
    if (!isAdmin) return;
    setConfirmAction({
      type: 'delete',
      id,
      message: `Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi danh sách?`
    });
  };

  const handleReset = () => {
    if (!isAdmin) return;
    setConfirmAction({
      type: 'reset',
      message: "Bạn có chắc chắn muốn XÓA TOÀN BỘ danh sách thành viên hiện tại? Hành động này không thể hoàn tác."
    });
  };

  const executeConfirmAction = async () => {
  if (!confirmAction) return;

  if (confirmAction.type === "delete" && confirmAction.id) {
    await removePlayer(confirmAction.id);
  }

  if (confirmAction.type === "reset") {
    await resetPlayers();
  }

  await fetchPlayers?.(); // nếu bạn có fetchPlayers trong hook
  setConfirmAction(null);
};

  const occupancyRate = Math.min(Math.round((players.length / config.maxSlots) * 100), 100);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-emerald-600 font-bold animate-pulse">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Navigation */}
      <nav className="bg-emerald-700 text-white px-4 md:px-8 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Users className="text-emerald-700" size={24} />
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight uppercase">Cầu Lông NiuBi</span>
        </div>
        <div className="flex space-x-2 md:space-x-6 items-center text-xs md:text-sm font-medium">
          <a 
            href="#" 
            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/20"
          >
            <Plus size={14} className="text-emerald-200" />
            <span className="hidden sm:inline">Đăng Ký Slot</span>
            <span className="sm:hidden">Đăng ký</span>
          </a>
          <button 
            onClick={handleAdminToggle}
            className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-full transition-all ${isAdmin ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-emerald-600/50 hover:bg-emerald-600 text-white border border-emerald-500/30'}`}
          >
            <Shield size={14} />
            <span className="inline">{isAdmin ? 'Thoát' : 'Admin'}</span>
          </button>
        </div>
      </nav>

      {/* Admin Password Input Area */}
      <AnimatePresence>
        {showPwdInput && !isAdmin && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-800 text-white overflow-hidden"
          >
            <div className="container mx-auto px-4 md:px-8 py-4">
              <form onSubmit={handleAdminAuth} className="flex flex-col sm:flex-row items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Xác thực Admin:</span>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input 
                    type="password" 
                    autoFocus
                    placeholder="Nhập mật khẩu..." 
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm w-full sm:w-64 focus:ring-2 focus:ring-amber-400 outline-none"
                    value={adminPwd}
                    onChange={(e) => setAdminPwd(e.target.value)}
                  />
                  <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-1.5 rounded text-sm transition-colors whitespace-nowrap">
                    Đăng nhập
                  </button>
                </div>
                {adminError && <span className="text-red-400 text-xs font-bold">{adminError}</span>}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 container mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8">
        {/* Left Section: Participant List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col mb-4 lg:mb-0">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-xl">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{config.sessionTitle}</h2>
              <p className="text-sm text-slate-500">{config.sessionTime}</p>
            </div>
            <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded-full ${players.length >= config.maxSlots ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {players.length >= config.maxSlots ? 'Đã Hết Chỗ' : `Còn ${config.maxSlots - players.length}/${config.maxSlots} Chỗ`}
            </span>
          </div>
          
          <div className="flex-1 p-4 md:p-6 overflow-y-auto max-h-[60vh] md:max-h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence initial={false}>
                {players.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between group hover:border-emerald-300 transition-colors shadow-sm"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-slate-400 w-6">{(index + 1).toString().padStart(2, '0')}</span>
                      <span className="font-semibold text-slate-700">{player.name}</span>
                    </div>
                    {isAdmin ? (
                      <button 
                        onClick={() => handleDelete(player.id, player.name)}
                        className="text-slate-400 hover:text-red-500 transition-colors bg-white p-1 rounded-full border border-slate-200"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-500 opacity-60" />
                    )}
                  </motion.div>
                ))}
                
                {Array.from({ length: Math.max(0, config.maxSlots - players.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-3 bg-slate-50/30 rounded-lg border border-slate-100 flex items-center justify-between border-dashed">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-slate-200 w-6">{(players.length + i + 1).toString().padStart(2, '0')}</span>
                      <span className="italic text-slate-300 text-sm">Trống...</span>
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
            
            {players.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Users className="mx-auto mb-3 opacity-10" size={64} />
                <p className="text-sm font-medium">Chưa có ai đăng ký tham gia</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
            <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="Nhập tên đầy đủ..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={players.length >= config.maxSlots}
              />
              <button 
                type="submit"
                disabled={players.length >= config.maxSlots}
                className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {players.length >= config.maxSlots ? 'HẾT CHỖ' : 'THAM GIA'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Section: Admin & Stats */}
        <div className="w-full lg:w-80 flex flex-col space-y-6">
          {/* Admin Panel Card */}
          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 text-white p-6 rounded-xl shadow-xl border border-slate-700 shadow-emerald-900/20"
            >
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="text-amber-400" size={20} />
                <h3 className="text-sm font-bold uppercase tracking-wider">Tùy chỉnh buổi tập</h3>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Tên buổi tập</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-amber-400 outline-none"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Thời gian</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-amber-400 outline-none"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Slot tối đa</label>
                  <input 
                    type="number" 
                    min="8"
                    max="16"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-amber-400 outline-none"
                    value={editMaxSlots}
                    onChange={(e) => setEditMaxSlots(parseInt(e.target.value))}
                  />
                  <p className="text-[9px] text-slate-500 mt-1 italic">Tối thiểu 8, tối đa 16 người</p>
                </div>
                <button 
                  onClick={handleUpdateConfig}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold transition-colors"
                >
                  Lưu cấu hình
                </button>
              </div>
              
              <div className="space-y-3 border-t border-slate-700 pt-4 text-center">
                <button 
                  onClick={handleReset}
                  className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                >
                  <RotateCcw size={14} />
                  Xóa danh sách
                </button>
              </div>
            </motion.div>
          )}

          {/* Statistics Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Lượt đăng ký</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600 font-medium">Tỷ lệ chỗ kín</span>
                  <span className={`font-bold ${occupancyRate > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{occupancyRate}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${occupancyRate}%` }}
                    className={`h-full rounded-full ${occupancyRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-2xl font-bold text-slate-800">{players.length.toString().padStart(2, '0')}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Tham gia</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-2xl font-bold text-slate-800">{Math.max(0, config.maxSlots - players.length).toString().padStart(2, '0')}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Còn trống</div>
                </div>
              </div>
            </div>
          </div>

          {/* Information Box */}
          <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg shadow-sm">
            <div className="flex gap-3">
              <Shield className="text-blue-500 flex-shrink-0" size={16} />
              <p className="text-xs text-blue-700 leading-relaxed font-medium">
                <strong>Lưu ý:</strong> Hủy slot ít nhất 2 tiếng trước khi buổi tập bắt đầu để nhường chỗ cho người khác.
              </p>
            </div>
          </div>


        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-8 py-4 text-[10px] text-slate-400 flex flex-col md:flex-row justify-between items-center gap-2 uppercase tracking-widest mt-auto">
        <span>Cầu Lông NiuBi v3.0.0 (Static)</span>
        <span className="flex items-center gap-1">
          Design by <span className="text-emerald-600 font-bold">Dxuann</span>
        </span>
      </footer>

      {/* Confirmation Modal Overlay */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Trash2 className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                  Xác nhận hành động
                </h3>
                <p className="text-slate-600 text-center text-sm leading-relaxed mb-6 px-4">
                  {confirmAction.message}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={executeConfirmAction}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors text-sm shadow-lg shadow-red-200"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
