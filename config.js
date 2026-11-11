/* 공개 정보만 입력하세요. 개인정보·보험증권 번호·인증정보 금지. */
window.MANUAL_CONFIG = {
  version: "2026-11-11.1",
  reviewedAt: "2026-11-11",
  // 실제 매뉴얼 index.html 주소. 배포 전에는 빈 문자열로 유지합니다.
  deploymentUrl: "",
  internalContact: {
    label: "강원동부지사 안전담당",
    phones: ["033-650-5744", "033-650-5745"]
  },
  // 실제 업무용 차량 정보만 등록하세요. 알 수 없는 ID에 다른 차량을 대입하지 않습니다.
  // { id: "car-01", plate: "실제 차량번호", model: "실제 차종", insurer: "실제 가입 보험사", accidentPhone: "확인된 사고접수 번호" }
  vehicles: []
};
