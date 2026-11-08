# 기능 브랜치 작업 경계

## 현재 지도 PR

`codex/campus-trade-location`은 최신 main의 이메일 로그인·상품 이미지 업로드·상세 이미지·삭제 기능을 포함합니다.
등록 화면은 `TradeLocationPicker`를 호출하며, 지도 입력·자동 건물명·좌표 저장은 지도 컴포넌트에서 관리합니다.
인증, Storage, 기존 DB 정책을 지도 기능에 맞춰 변경하지 않습니다.

## 후속 브랜치

반납과 채팅은 같은 최신 origin/main에서 각각 시작합니다. 아직 기능 코드는 없습니다.
계획 문서만 서로 다른 경로로 추가해 빈 PR과 기능 완료를 혼동하지 않도록 합니다.

| 브랜치 | 주 담당 파일/영역 | 준비 문서 |
| --- | --- | --- |
| codex/return-management | src/features/returns/**, tests/returns/** | docs/RETURN_MANAGEMENT_PLAN.md |
| codex/item-chat | src/features/chat/**, src/app/messages/**, tests/chat/** | docs/ITEM_CHAT_PLAN.md |
| codex/campus-trade-location | CampusMap, TradeLocationPicker, TradeLocation, campus-location, map-viewport | CAMPUS_MAP.md |

## 통합 순서

1. 지도 PR에서 인증·사진·지도 동작 확인 후 팀 통합 담당자가 main으로 병합합니다.
2. 후속 브랜치에서 실제 코드를 작성하기 전에 origin을 fetch하고 최신 main을 각 작업 브랜치에 반영합니다. 준비 문서만 있는 상태에서는 이번 지도 변경과 겹치는 수정이 없습니다.
3. 반납·채팅은 각자의 feature 폴더에서 구현합니다. DB 변경이 필요하면 실제 테이블·정책을 먼저 확인하고 팀 DB 담당자와 적용 시점을 맞춥니다.
4. `src/app/items/[id]/page.tsx` 또는 `src/app/trades/page.tsx` 연결은 동시에 수정하지 않습니다. 반납 연결 PR을 먼저 병합한 뒤 채팅 브랜치를 최신 main으로 갱신하고 연결합니다.
5. 공통 인증·Supabase 클라이언트·타입·package.json·lock 파일 변경은 공유하고 한 사람이 통합합니다.
6. 각 PR에 타입 검사/빌드/해당 기능 테스트 결과와 DB 적용 필요 여부를 명시합니다. 한 기능씩 병합하고 main에는 직접 push하지 않습니다.

브랜치 분리만으로 충돌이 영구히 없어지지는 않습니다. main 변경 후 갱신과 공용 화면 파일의 순차 통합이 필요합니다.
