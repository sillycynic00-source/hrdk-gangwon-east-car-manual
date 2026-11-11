/* Pure helpers shared by the browser and dependency-free checks. */
(function (root) {
  "use strict";
  function phoneInfo(value) {
    const label = String(value || "").trim();
    if (!/^[0-9 -]+$/.test(label)) return null;
    const digits = label.replace(/[^0-9]/g, "");
    return /^[0-9]{8,12}$/.test(digits) ? { label, href: "tel:" + digits } : null;
  }
  function selectVehicle(vehicles, id) {
    if (!id) return null;
    const matches = (Array.isArray(vehicles) ? vehicles : []).filter(v => v && v.id === id);
    return matches.length === 1 ? matches[0] : null;
  }
  function deploymentTarget(value, vehicleId) {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
      if (/^(localhost|127\.|0\.|\[::1\]|.*\.local$|example\.)/i.test(url.hostname)) return null;
      if (!url.pathname.endsWith("/") && !url.pathname.endsWith("/index.html")) return null;
      if (vehicleId) url.searchParams.set("vehicle", vehicleId);
      return url.href;
    } catch { return null; }
  }
  const reportFields = [["occurredAt","사고 일시"],["plate","차량번호"],["place","사고 장소 및 진행 방향"],["people","운전자·동승자"],["injury","인명피해 여부"],["summary","간략한 사고 경위"],["drivable","차량 운행 가능 여부"],["emergencyReport","경찰·소방 신고 여부"],["claim","보험 접수번호"],["action","현재 조치 상황"]];
  function createReport(values) {
    return "공용차 교통사고 보고 초안\n" + reportFields.map(([key, label]) => label + ": " + (String(values[key] || "").trim() || "미확인")).join("\n");
  }
  root.MANUAL_UTILS = { phoneInfo, selectVehicle, deploymentTarget, createReport };
})(typeof window !== "undefined" ? window : globalThis);
