# Artemis II Research Notes

## 핵심 근거

NASA의 최신 Artemis II mission page는 임무가 2026년 4월 1일 발사되어 2026년 4월 10일 착수했으며, 총 임무 시간이 9일 1시간 32분이었다고 정리한다. 이 프로젝트의 시뮬레이션 시간축은 해당 날짜를 기준으로 삼았다.

AROW 페이지는 공개 추적 시스템이 Orion 센서와 Mission Control 데이터에서 나온 상태벡터를 제공하며, ephemeris를 자체 시각화와 물리 모델에 사용할 수 있다고 설명한다. 따라서 궤적의 중심 데이터는 NASA가 배포한 OEM 파일을 사용했다.

NASA SVS의 Artemis II trajectory visual은 실제 비행에서 파생된 ephemeris 기반 시각화라고 밝히며, 자유귀환 궤적이 지구와 달의 중력장을 이용해 crew를 자연스럽게 귀환시키는 구조임을 설명한다. 앱에서는 이 구조가 보이도록 전체 궤적을 지구-달 공간에 고정 표시했다.

NASA FAQ는 발사 시각, 총 예상/실제 거리, 달 최근접 고도, Apollo 13 거리 기록 돌파, 달 뒤편 통신 두절, 태양식, entry interface 고도와 blackout 조건을 제공한다. 이 값들은 UI event markers와 reentry cue에 반영했다.

NTRS AAS 23-062는 Artemis II가 Apollo 8을 연상시키는 자유귀환 cislunar profile을 쓰며, TLI 후 명목상 큰 translational burn 없이 귀환할 수 있지만 항법 오차, 실행 오차, crew schedule, disturbance acceleration 때문에 trajectory correction burn placement가 필요하다고 설명한다. 앱의 return leg와 correction burn 이벤트는 이 전제를 따른다.

NASA Crew Systems와 Spacecraft Components 문서는 Orion crew module의 생명유지, 유리 조종석, 방사선/미소운석 보호, 4인 21일 지원 능력, OCSS suit의 최대 6일 survival 기능을 설명한다. UI의 crewed-flight context와 cabin/window view는 이 자료를 기준으로 구성했다.

CSA Artemis II science page는 방사선 모니터링, 6개 active radiation sensor, crew dosimeter, lunar far-side observation, Orientale Basin 등 지질 관측 목표를 설명한다. 앱의 radiation belt toggle과 lunar observation brief는 이 자료를 반영했다.

## 반영한 수치

- Launch: 2026-04-01 18:35 EDT / 22:35 UTC
- TLI: 2026-04-02 19:49 EDT, 약 5분 50초
- Lunar observation window: 약 7시간
- Far-side communication loss: 2026-04-06 18:44-19:25 EDT
- Closest lunar approach: 약 4,067 miles above lunar surface
- Max distance: 약 252,756 miles from Earth
- Entry interface: 약 400,000 ft, 최대 약 23,864 mph, 약 6분 blackout
- Splashdown: 2026-04-10 20:07 EDT / 2026-04-11 00:07 UTC, San Diego offshore

## 모델링 선택

실제 Orion과 SLS는 지구-달 스케일에서 픽셀보다 작으므로 시각적으로 확대했다. 궤적, 지구-달 거리, 달 위치, 태양 방향은 km 기반으로 처리하고, spacecraft mesh만 educational marker로 과장했다.

OEM은 2026-04-02 01:57 UTC부터 entry interface까지 제공된다. 발사부터 OEM 시작 전까지는 launch pad와 첫 OEM 위치를 이어주는 절차적 bridge를 사용했다. Entry interface 이후 splashdown까지도 NASA reentry timeline에 맞춘 절차적 bridge다.

달과 태양의 지구중심 벡터는 `astronomy-engine`의 J2000/EQJ 계열 계산을 사용했다. NASA OEM의 EME2000과 같은 J2000 계열 시각화에 적합하지만, 정밀 항법 수준의 frame 변환 검증은 범위 밖이다.

## 개선 여지

- NASA OEM의 여러 날짜별 update 파일을 비교해 burn 전후 trajectory delta를 별도 레이어로 표시
- AROW 원본 format metadata와 covariance가 공개될 경우 uncertainty envelope 렌더링
- Orion 내부 3D 모델, crew seating, displays, OCSS suit 상태를 더 상세히 모델링
- Reentry descent events를 고도별로 더 세분화해 parachute sequence까지 3D로 구현
