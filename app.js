(function () {
"use strict";
const config = window.MANUAL_CONFIG || {};
const utils = window.MANUAL_UTILS;
if (!utils) return;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const vehicles = Array.isArray(config.vehicles) ? config.vehicles : [];
let vehicleId = new URLSearchParams(location.search).get("vehicle") || "";
let currentVehicle = utils.selectVehicle(vehicles, vehicleId);
let stepIndex = 0;
const dialog = $("#field-mode");
const originalSteps = $$("[data-step]");
function button(label, href) {
  const a = document.createElement("a");
  a.className = "button phone"; a.textContent = "☎ " + label; a.href = href;
  return a;
}
function renderContacts() {
  const internal = config.internalContact;
  if (!internal || !Array.isArray(internal.phones)) return;
  const phones = internal.phones.map(utils.phoneInfo).filter(Boolean);
  // Keep the verified static contacts if configuration is incomplete.
  if (phones.length !== 2 || !internal.label) return;
  $$("[data-internal-contacts]").forEach(box => {
    const title = document.createElement("p");
    title.className = "contact-label"; title.textContent = internal.label;
    const pair = document.createElement("div"); pair.className = "phone-pair";
    phones.forEach(p => { const a = button(p.label, p.href); a.setAttribute("aria-label", internal.label + " " + p.label + " 전화"); pair.append(a); });
    box.replaceChildren(title, pair);
  });
}
function renderInsurance() {
  const phone = currentVehicle && utils.phoneInfo(currentVehicle.accidentPhone);
  $$("[data-insurance]").forEach(box => {
    const p = document.createElement("p");
    p.textContent = currentVehicle ? (currentVehicle.insurer || "보험사 확인 필요") : vehicleId ? "등록되지 않은 차량 · 보험 연락처 확인 필요" : "차량별 보험 연락처 확인 필요";
    const call = phone && currentVehicle.insurer ? button(phone.label, phone.href) : document.createElement("button");
    if (!phone || !currentVehicle?.insurer) { call.type = "button"; call.disabled = true; call.textContent = "보험사 전화 · 확인 필요"; }
    else call.setAttribute("aria-label", currentVehicle.insurer + " 사고접수 " + phone.label + " 전화");
    box.replaceChildren(p, call);
  });
}
function renderVehicle() {
  currentVehicle = utils.selectVehicle(vehicles, vehicleId);
  const status = $("#vehicle-status");
  if (status) status.textContent = currentVehicle ? [currentVehicle.plate || "차량번호 확인 필요", currentVehicle.model || "차종 확인 필요", currentVehicle.insurer || "보험사 확인 필요"].join(" · ") : vehicleId ? "등록되지 않은 차량입니다. 차량 식별자와 보험 연락처를 확인하세요." : vehicles.length ? "차량을 선택하면 해당 차량의 보험 연락처를 확인할 수 있습니다." : "차량 정보 미등록 · 차량별 보험 연락처 확인 필요";
  renderInsurance();
  const plate = $("#report-plate"); if (plate) plate.value = currentVehicle?.plate || "";
  const link = $("#print-link") || $("#back-link");
  if (link) link.href = ($("#print-link") ? "./print.html" : "./index.html") + (vehicleId ? "?vehicle=" + encodeURIComponent(vehicleId) : "");
  if ($("#print-sheet")) renderCards();
}
const select = $("#vehicle-select");
if (select) {
  const seen = new Set();
  vehicles.forEach(v => {
    if (!v || typeof v.id !== "string" || !v.id || seen.has(v.id) || !utils.selectVehicle(vehicles, v.id)) return;
    seen.add(v.id); const option = document.createElement("option"); option.value = v.id; option.textContent = (v.plate || v.id) + (v.model ? " · " + v.model : ""); select.append(option);
  });
  if (vehicleId && !currentVehicle) { const option = document.createElement("option"); option.value = vehicleId; option.textContent = "등록되지 않은 차량"; select.append(option); }
  select.value = vehicleId; select.disabled = false;
  select.addEventListener("change", () => {
    vehicleId = select.value; renderVehicle();
    if (/^https?:$/.test(location.protocol)) { const url = new URL(location.href); if (vehicleId) url.searchParams.set("vehicle", vehicleId); else url.searchParams.delete("vehicle"); history.replaceState(null, "", url); }
  });
}
function renderMode() {
  const clone = originalSteps[stepIndex].cloneNode(true);
  $$("[id]", clone).forEach(el => el.removeAttribute("id"));
  clone.removeAttribute("id"); clone.removeAttribute("aria-labelledby");
  const title = $("h3", clone); title.id = "mode-step-title"; title.tabIndex = -1;
  clone.setAttribute("aria-labelledby", title.id);
  $("#mode-content").replaceChildren(clone);
  $("#step-progress").textContent = (stepIndex + 1) + " / " + originalSteps.length;
  $("#previous-step").disabled = stepIndex === 0;
  $("#next-step").textContent = stepIndex === originalSteps.length - 1 ? "전체 절차로 돌아가기" : "다음 →";
  dialog.scrollTop = 0;
  title.focus({ preventScroll: true });
}
if (dialog && typeof dialog.showModal === "function") {
  ["#start-mode", "#bottom-mode"].forEach(id => { const b = $(id); b.disabled = false; b.addEventListener("click", () => { stepIndex = 0; dialog.showModal(); renderMode(); }); });
  $("#close-mode").addEventListener("click", () => dialog.close());
  $("#previous-step").addEventListener("click", () => { if (stepIndex > 0) { stepIndex--; renderMode(); } });
  $("#next-step").addEventListener("click", () => { if (stepIndex === originalSteps.length - 1) dialog.close(); else { stepIndex++; renderMode(); } });
  dialog.addEventListener("click", event => { const link = event.target.closest('a[href="#report"]'); if (link) { event.preventDefault(); dialog.close(); $("#report").scrollIntoView(); $("#report-occurredAt").focus({preventScroll:true}); } });
}
async function copyText(textarea, status) {
  if (!textarea.value.trim()) { status.textContent = "복사할 내용을 먼저 입력하거나 생성하세요."; return; }
  try {
    if (!navigator.clipboard?.writeText) throw new Error("unsupported");
    await navigator.clipboard.writeText(textarea.value);
    status.textContent = "복사했습니다. 필요한 곳에 직접 붙여 넣어 전달하세요.";
  } catch {
    textarea.focus(); textarea.select(); textarea.setSelectionRange(0, textarea.value.length);
    status.textContent = "자동 복사를 사용할 수 없습니다. 선택된 내용을 길게 누르거나 Ctrl+C로 직접 복사하세요.";
  }
}
const locate = $("#locate");
if (locate) {
  const area = $("#location-text"), status = $("#location-status"), map = $("#map-link");
  locate.disabled = false; $("#copy-location").disabled = false;
  locate.addEventListener("click", () => {
    map.hidden = true;
    if (!navigator.geolocation) { status.textContent = "위치 조회를 지원하지 않습니다. 도로명·진행 방향을 직접 입력하세요."; return; }
    locate.disabled = true; status.textContent = "현재 위치 확인 중입니다. 위치를 자동 전송하지 않습니다.";
    navigator.geolocation.getCurrentPosition(pos => {
      locate.disabled = false;
      const lat = pos.coords.latitude.toFixed(6), lon = pos.coords.longitude.toFixed(6);
      area.value = "위도 " + lat + ", 경도 " + lon;
      status.textContent = "좌표를 확인했습니다. 예상 오차 약 " + Math.round(pos.coords.accuracy) + "m. 실제 도로명·진행 방향을 별도로 확인하세요.";
      map.href = "https://www.openstreetmap.org/?mlat=" + lat + "&mlon=" + lon + "#map=17/" + lat + "/" + lon; map.hidden = false;
    }, error => {
      locate.disabled = false;
      status.textContent = (error.code === 1 ? "위치 권한이 거부되었습니다." : "현재 위치를 확인하지 못했습니다.") + " 도로명·진행 방향·주변 표지를 직접 입력하세요.";
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
  area.addEventListener("input", () => { map.hidden = true; status.textContent = "직접 입력한 위치입니다. 확인 후 복사하세요."; });
  $("#copy-location").addEventListener("click", () => copyText(area, status));
}
const form = $("#report-form");
if (form) {
  $("#make-report").disabled = false;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    $("#report-output").value = utils.createReport(values);
    $("#copy-report").disabled = false;
    $("#report-status").textContent = "입력하지 않은 항목은 미확인입니다. 내용을 확인한 뒤 복사하세요.";
  });
  $("#copy-report").addEventListener("click", () => copyText($("#report-output"), $("#report-status")));
  form.addEventListener("reset", () => {
    $("#report-output").value = ""; $("#copy-report").disabled = true;
    $("#report-status").textContent = "보고 입력 내용과 초안을 초기화했습니다.";
  });
  // Prevent accidental browser form restoration from retaining incident details.
  $$("input,textarea", form).forEach(el => el.setAttribute("autocomplete", "off"));
  window.addEventListener("pageshow", event => { if (event.persisted) form.reset(); });
}
function renderCards() {
  const sheet = $("#print-sheet");
  if (!sheet) return;
  $$(".qr-card", sheet).slice(1).forEach(card => card.remove());
  const card = $(".qr-card", sheet);
  const target = utils.deploymentTarget(config.deploymentUrl, currentVehicle ? vehicleId : "");
  const usableTarget = target && (!vehicleId || currentVehicle);
  const status = $("#print-status");
  const box = $("[data-qr]", card); box.replaceChildren(); box.classList.remove("ready");
  let qrReady = false;
  if (usableTarget && typeof window.qrcode === "function") {
    try {
      const qr = window.qrcode(0, "Q");
      qr.addData(target, "Byte"); qr.make();
      // Four-module quiet zone; avoid unreadably dense QR in the 35mm print box.
      if (qr.getModuleCount() > 77) throw new Error("dense");
      const parser = new DOMParser();
      const svg = parser.parseFromString(qr.createSvgTag(4, 16), "image/svg+xml").documentElement;
      svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "공용차 사고대응 매뉴얼 QR코드");
      box.append(document.importNode(svg, true)); box.classList.add("ready"); qrReady = true;
    } catch { box.textContent = "주소가 너무 길거나 QR 생성에 실패했습니다."; }
  } else box.textContent = vehicleId && !currentVehicle ? "차량 식별자 확인 후 생성" : "배포 주소 설정 후 생성";
  $("[data-card-url]", card).textContent = usableTarget ? target : "배포 주소 설정 후 표시";
  const vehicle = $("[data-card-vehicle]", card);
  const phone = currentVehicle && utils.phoneInfo(currentVehicle.accidentPhone);
  vehicle.replaceChildren();
  if (currentVehicle) {
    const text = document.createElement("span");
    text.textContent = (currentVehicle.plate || "차량번호 확인 필요") + " · " + (currentVehicle.insurer || "보험사 확인 필요") + " ";
    vehicle.append(text);
    if (phone && currentVehicle.insurer) { const call = document.createElement("a"); call.href = phone.href; call.textContent = phone.label; vehicle.append(call); }
    else vehicle.append(document.createTextNode("보험 연락처 확인 필요"));
  } else vehicle.textContent = vehicleId ? "등록되지 않은 차량 · 보험 연락처 확인 필요" : "공통 안내카드 · 차량별 보험 연락처 확인 필요";
  status.textContent = qrReady ? "설정한 배포 주소로 QR을 생성했습니다. 실제 접속과 최종 인쇄 크기에서 스캔을 확인한 뒤 비치하세요." : "검토용 카드 · " + box.textContent + ". 실제 배포 전 설정과 스캔 확인이 필요합니다.";
  if (!qrReady) status.className = "warning"; else status.className = "";
  const isA4 = $("#paper-size").value === "a4";
  sheet.classList.toggle("a4", isA4);
  if (isA4) for (let i = 0; i < 3; i++) sheet.append(card.cloneNode(true));
  let pageStyle = $("#paper-style");
  if (!pageStyle) { pageStyle = document.createElement("style"); pageStyle.id = "paper-style"; document.head.append(pageStyle); }
  pageStyle.textContent = "@page { size: " + (isA4 ? "210mm 297mm" : "105mm 148mm") + "; margin: 0; }";
}
renderContacts();
$$("[data-version]").forEach(el => { if (config.version) el.textContent = config.version; });
$$("[data-reviewed]").forEach(el => { if (config.reviewedAt) el.textContent = config.reviewedAt; });
renderVehicle();
if ($("#paper-size")) {
  $("#paper-size").addEventListener("change", renderCards);
  $("#print-button").addEventListener("click", () => window.print());
}
})();
