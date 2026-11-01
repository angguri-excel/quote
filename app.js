let ITEMS = [];
let draftReady = false;
let dirty = false;       // 사용자가 내용을 건드렸는지 (나갈 때 경고용)   // 처음 화면을 만드는 동안에는 임시 저장을 하지 않는다
const DRAFT_KEY = "quote-draft-v1";
const META_IDS = ["quote-no", "quote-date", "customer", "valid"];
const DEFAULT_ITEMS = JSON.parse(document.getElementById("items-data").textContent);
const $ = (id) => document.getElementById(id);
const won = (n) => n.toLocaleString("ko-KR");

// 금액 → 한글 ("123400" → "일십이만삼천사백")
function toHangul(n) {
  if (n === 0) return "영";
  const digit = "영일이삼사오육칠팔구";
  const small = ["", "십", "백", "천"];
  const big = ["", "만", "억", "조"];
  let out = "";
  const s = String(n);
  const groups = Math.ceil(s.length / 4);
  for (let g = 0; g < groups; g++) {
    const part = s.slice(Math.max(0, s.length - 4 * (g + 1)), s.length - 4 * g);
    let text = "";
    for (let i = 0; i < part.length; i++) {
      const d = Number(part[i]);
      if (d) text += digit[d] + small[part.length - 1 - i];
    }
    if (text) out = text + big[g] + out;
  }
  return out;
}

function optionsHtml() {
  return ['<option value="">-- 품목 선택 --</option>']
    .concat(ITEMS.map((it, i) => `<option value="${i}">${it.name}</option>`)).join("");
}

// 품목표가 바뀌면 이미 고른 품목은 이름으로 다시 찾아 맞춘다
function setItems(items) {
  const keep = [...$("rows").children].map((tr) => (ITEMS[tr.querySelector("select").value] || {}).name);
  ITEMS = items;
  [...$("rows").children].forEach((tr, i) => {
    const sel = tr.querySelector("select");
    sel.innerHTML = optionsHtml();
    const idx = ITEMS.findIndex((it) => it.name === keep[i]);
    sel.value = idx >= 0 ? String(idx) : "";
  });
  update();
}

function addRow() {
  const tr = document.createElement("tr");
  const opts = optionsHtml();
  tr.innerHTML = `
    <td class="center no"></td>
    <td><select>${opts}</select></td>
    <td class="center unit"></td>
    <td><input type="number" min="0" value="1"></td>
    <td class="num price">0</td>
    <td class="num amt">0</td>
    <td class="c-del no-print"><button class="del" title="삭제">×</button></td>`;
  tr.querySelector("select").addEventListener("change", () => update());
  tr.querySelector("input").addEventListener("input", () => update());
  tr.querySelector(".del").addEventListener("click", () => { tr.remove(); update(); });
  $("rows").appendChild(tr);
  update();
}

function update() {
  let supply = 0;
  [...$("rows").children].forEach((tr, i) => {
    const item = ITEMS[tr.querySelector("select").value];
    const qty = Math.max(0, Math.floor(Number(tr.querySelector("input").value)) || 0);
    const price = item ? item.price : 0;
    const amt = qty * price;
    tr.querySelector(".no").textContent = i + 1;
    tr.querySelector(".unit").textContent = item ? item.unit : "";
    tr.querySelector(".price").textContent = item ? won(price) : "";
    tr.querySelector(".amt").textContent = item ? won(amt) : "";
    supply += amt;
  });
  const vat = Math.round(supply * 0.1);
  const total = supply + vat;
  $("supply").textContent = won(supply);
  $("vat").textContent = won(vat);
  $("total").textContent = won(total);
  $("hangul").textContent = toHangul(total);
  $("hangul-num").textContent = won(total);
  saveDraft();
}

// 작성 중인 견적서를 이 브라우저에만 임시 저장 (새로고침해도 남게, 서버로 보내지 않음)
function saveDraft() {
  if (!draftReady) return;
  try {
    const d = { meta: {}, rows: [...$("rows").children].map((tr) => ({
      name: (ITEMS[tr.querySelector("select").value] || {}).name || "",
      qty: tr.querySelector("input").value
    })) };
    META_IDS.forEach((id) => { d.meta[id] = $(id).value; });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch (e) {}
}
function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return d && Array.isArray(d.rows) && d.meta ? d : null;
  } catch (e) { return null; }
}
function restoreDraft(d) {
  META_IDS.forEach((id) => { if (d.meta[id] !== undefined) $(id).value = d.meta[id]; });
  while ($("rows").children.length < d.rows.length) addRow();
  while ($("rows").children.length > d.rows.length) $("rows").lastElementChild.remove();
  [...$("rows").children].forEach((tr, i) => {
    const idx = ITEMS.findIndex((it) => it.name === d.rows[i].name);
    tr.querySelector("select").value = idx >= 0 ? String(idx) : "";
    tr.querySelector("input").value = d.rows[i].qty;
  });
  update();
}

$("add-row").addEventListener("click", addRow);
$("print").addEventListener("click", () => window.print());
$("quote-date").value = new Date().toISOString().slice(0, 10);
$("load-csv").addEventListener("click", () => $("csv-file").click());
$("csv-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const text = await f.text(); const items = csvToItems(text);
  if (!items.length) { alert("읽을 수 있는 품목이 없어요. 첫 줄은 제목, 이후 품목·단위·단가 순서인지 확인하세요."); return; }
  rememberCSV(text); setItems(items); e.target.value = "";
});
// 품목 관리에서 저장하면 견적서 화면이 바로 따라가도록: 다른 탭에서 저장 신호가 오거나 이 탭으로 돌아올 때 다시 읽는다
async function refreshItems() {
  const items = await loadItems(DEFAULT_ITEMS);
  if (JSON.stringify(items) !== JSON.stringify(ITEMS)) setItems(items);
}
window.addEventListener("storage", (e) => { if (e.key === CSV_KEY) refreshItems(); });
window.addEventListener("focus", refreshItems);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshItems(); });
META_IDS.forEach((id) => $(id).addEventListener("input", saveDraft));
$("reset").addEventListener("click", () => {
  if (!confirm("작성 중인 내용을 지우고 새 견적서로 시작할까요?")) return;
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  dirty = false;
  location.reload();
});
loadItems(DEFAULT_ITEMS).then((items) => {
  ITEMS = items;
  const draft = readDraft();
  for (let i = 0; i < 5; i++) addRow();
  if (draft) { restoreDraft(draft); dirty = true; }
  draftReady = true;
  saveDraft();
});

// 작성 중에 페이지를 나가거나 새로고침하려 하면 브라우저 경고창을 띄운다
// (경고 문구는 브라우저가 정해서 바꿀 수 없다. 내용은 임시 저장되어 있다)
const markDirty = (e) => { if (draftReady && !(e && e.target && e.target.id === "csv-file")) dirty = true; };
document.addEventListener("input", markDirty);
document.addEventListener("change", markDirty);
$("add-row").addEventListener("click", markDirty);
$("rows").addEventListener("click", (e) => { if (e.target.classList && e.target.classList.contains("del")) markDirty(); });
window.addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});
