# Artemis II Integrity Experience

NASA가 공개한 Artemis II AROW OEM 상태벡터를 기반으로 만든 인터랙티브 3D 유인 달 비행 체험 시뮬레이터입니다. 발사 직후부터 재진입 직전까지의 Orion 위치는 NASA/JSC/FOD/FDO ephemeris를 사용하고, 발사 상승 및 착수 직전 구간은 NASA 공개 타임라인에 맞춘 시각적 bridge로 구성했습니다.

## 실행

```bash
npm install
npm run build:data
npm run dev
```

로컬 서버가 뜨면 브라우저에서 안내된 localhost 주소를 엽니다.

## 주요 기능

- 실제 Artemis II OEM 상태벡터 3,262개 샘플 기반 궤적
- 지구 중심 EME2000/J2000 좌표계 시각화
- Astronomy Engine으로 계산한 같은 시각의 달/태양 지구중심 벡터
- 전체 궤적, 지구 궤도, Orion 창밖, 달 근접, 재진입, 자유 시점
- 통신 두절, 달 뒤편 flyby, 태양식, 방사선대, 재진입 plasma cue
- 한국어 HUD: UTC, MET, 지구/달 거리, 속도, active mission phase
- 연구 출처와 이벤트별 근거가 UI에 노출됨

## 데이터 처리

`scripts/build-mission-data.js`는 `data/oem/Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc`를 읽고 `public/data/artemis-ii-mission.json`을 생성합니다.

생성 결과 예시:

- OEM sample count: 3,262
- OEM 지구중심 최대 거리: 413,144.445 km
- 지구 반지름을 빼면 약 406,773 km, NASA의 252,756 mile 기록과 일치하는 범위
- 계산된 달 중심 최근접 거리: 8,293.276 km
- 달 반지름을 빼면 약 6,556 km, NASA의 4,067 mile 최근접 고도와 일치하는 범위

## 주의

이 프로젝트는 공개 자료 기반 교육/체험용 시뮬레이션입니다. 비행 소프트웨어, 항법 검증, 위험 평가에 쓸 수 있는 flight-certified 모델은 아닙니다. Orion/SLS의 외형 크기는 실제 축척대로 두면 화면에서 보이지 않기 때문에 시각화를 위해 확대했습니다.

## 출처

- NASA AROW Artemis II Ephemeris: https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/
- NASA SVS Artemis II mission trajectory: https://svs.gsfc.nasa.gov/5632/
- NASA Artemis II mission page: https://www.nasa.gov/mission/artemis-ii/
- NASA Artemis II Press Kit: https://www.nasa.gov/artemis-ii-press-kit/
- NASA Artemis II FAQ: https://www.nasa.gov/missions/nasa-answers-your-most-pressing-artemis-ii-questions/
- NASA Flight Day 9 reentry update: https://www.nasa.gov/blogs/missions/2026/04/09/artemis-ii-flight-day-9-crew-prepares-to-come-home/
- NASA Flight Day 10 burn/splashdown update: https://www.nasa.gov/blogs/missions/2026/04/10/artemis-ii-flight-day-10-crew-completes-final-burn-before-splashdown/
- NTRS AAS 23-062, trajectory correction burn placement: https://ntrs.nasa.gov/citations/20230000223
- NTRS Orion ECLSS acoustic mufflers: https://ntrs.nasa.gov/citations/20210013754
- NASA Orion spacecraft components: https://www.nasa.gov/reference/spacecraft-components/
- NASA Crew Systems / OCSS: https://www.nasa.gov/reference/crew-systems/
- NASA Space Launch System reference: https://www.nasa.gov/reference/space-launch-system/
- Canadian Space Agency Artemis II science: https://www.asc-csa.gc.ca/eng/missions/artemis-ii/scientific-research-during-mission.asp
- NASA SVS Moon texture source / LRO resources: https://svs.gsfc.nasa.gov/14959/
- NASA Earth Observatory Blue Marble texture: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/
