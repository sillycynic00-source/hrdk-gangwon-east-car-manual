/* 공개 정보만 입력하세요. 개인정보·보험증권 번호·인증정보 금지. */
window.MANUAL_CONFIG = {
  version: "2026-11-11.2",
  reviewedAt: "2026-11-11",
  // GitHub Pages 배포 성공과 HTTP 200 응답을 확인한 운영 주소입니다.
  deploymentUrl: "https://sillycynic00-source.github.io/hrdk-gangwon-east-car-manual/",
  internalContact: {
    label: "강원동부지사 안전담당",
    phones: ["033-650-5744", "033-650-5745"]
  },
  // 전 공단 공통 사용은 사용자 확인, 번호와 ARS는 보험사 공식 안내 확인.
  insurance: {
    insurer: "흥국화재",
    accidentPhone: "1688-1688",
    guide: "사고접수 ARS 1번 · 고장 긴급출동 ARS 2번"
  },
  // 실제 업무용 차량 정보만 등록하세요. 알 수 없는 ID에 다른 차량을 대입하지 않습니다.
  // { id: "car-01", plate: "실제 차량번호", model: "실제 차종", insurer: "실제 가입 보험사", accidentPhone: "확인된 사고접수 번호" }
  vehicles: []
};
