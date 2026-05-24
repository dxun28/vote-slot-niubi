import * as XLSX from "xlsx";
import type { AppConfig, Player } from "../services/badmintonService";

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "buoi-tap";
}

export function exportPlayersExcel(players: Player[], config: AppConfig): void {
  if (players.length === 0) {
    alert("Chưa có thành viên nào để xuất file.");
    return;
  }

  const attendedCount = players.filter((p) => p.attended).length;
  const paidCount = players.filter((p) => p.paid).length;
  const exportedAt = new Date().toLocaleString("vi-VN");

  const sheetData: (string | number)[][] = [
    ["CẦU LÔNG NIUBI — DANH SÁCH THÀNH VIÊN"],
    ["Buổi tập", config.sessionTitle],
    ["Thời gian", config.sessionTime],
    ["Xuất lúc", exportedAt],
    [],
    ["STT", "Họ tên", "Điểm danh", "Chuyển khoản"],
    ...players.map((player, index) => [
      index + 1,
      player.name,
      player.attended ? "Có" : "Chưa",
      player.paid ? "Có" : "Chưa",
    ]),
    [],
    ["Tổng cộng", players.length, attendedCount, paidCount],
    ["Ghi chú", "Có = đã tick trên hệ thống", "", ""],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 14 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách");

  const datePart = new Date().toISOString().slice(0, 10);
  const titlePart = sanitizeFilenamePart(config.sessionTitle);
  XLSX.writeFile(workbook, `danh-sach-${titlePart}-${datePart}.xlsx`);
}
