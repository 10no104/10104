# 레시피 스튜디오

GitHub Pages에서 실행되는 모바일 중심 레시피 관리 페이지입니다.

- 하단 내비게이션: 베이킹, 칵테일, 요리, 지도, 계산·정보
- 데이터 API: Google Apps Script Web App
- 설정 파일: `assets/js/config.js`
- Apps Script 예시: `apps-script/Code.gs`

기존 Google Spreadsheet 데이터 보호를 위해 앱 전용 탭은 모두 `App_` 접두사를 사용합니다.

## 지도 장소 데이터

`App_ReferenceData`에 아래 형식으로 행을 추가하면 지도에 핀이 표시됩니다.

- `category`: `place`
- `name`: 장소명
- `value`: `{"lat":37.5665,"lng":126.978,"type":"음식점","googleMapsUrl":"https://maps.google.com/..."}`
- `note`: 지도 팝업에 표시할 메모

지원 타입: `음식점`, `관광지`, `숙소`, `교통`, `기타`
