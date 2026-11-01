// 품목표 CSV 읽기·쓰기 (index.html, items.html 공용)
const CSV_KEY = "quote-items-csv";

function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function csvToItems(text) {
  return parseCSV(text)
    .map((r) => ({ name: (r[0] || "").trim(), unit: (r[1] || "").trim(), price: Number(String(r[2] || "").replace(/[,\s원]/g, "")) }))
    .filter((it) => it.name && Number.isFinite(it.price) && String(it.price) !== "NaN")
    .filter((it, i) => !(i === 0 && it.name === "품목"));
}

function itemsToCSV(items) {
  const q = (s) => (/[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  return "﻿품목,단위,단가\r\n" + items.map((it) => [q(it.name), q(it.unit), it.price].join(",")).join("\r\n") + "\r\n";
}

// items.csv → (파일만 열었을 때는 fetch가 막히므로) 브라우저에 저장해 둔 사본 → 파일 안 기본값 순서
async function loadItems(fallback) {
  try {
    const res = await fetch("items.csv", { cache: "no-store" });
    if (res.ok) { const items = csvToItems(await res.text()); if (items.length) return items; }
  } catch (e) { /* file:// 에서는 읽기가 막혀요 */ }
  try {
    const saved = localStorage.getItem(CSV_KEY);
    if (saved) { const items = csvToItems(saved); if (items.length) return items; }
  } catch (e) {}
  return fallback;
}

function rememberCSV(text) { try { localStorage.setItem(CSV_KEY, text); } catch (e) {} }
