import fs from "node:fs";
import path from "node:path";
import * as Astronomy from "astronomy-engine";

const ROOT = process.cwd();
const OEM_FILE = path.join(
  ROOT,
  "data/oem/Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc",
);
const OUT_DIR = path.join(ROOT, "public/data");
const OUT_FILE = path.join(OUT_DIR, "artemis-ii-mission.json");
const AU_KM = 149_597_870.7;

function parseOem(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d{4}-\d{2}-\d{2}T/.test(line))
    .map((line) => {
      const parts = line.split(/\s+/);
      const [epoch, x, y, z, vx, vy, vz] = parts;
      return {
        epoch,
        t: Date.parse(`${epoch}Z`),
        r: [Number(x), Number(y), Number(z)],
        v: [Number(vx), Number(vy), Number(vz)],
      };
    });
}

function mag(values) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function astroVectorKm(body, date) {
  const vector = Astronomy.GeoVector(body, date, false);
  return [vector.x * AU_KM, vector.y * AU_KM, vector.z * AU_KM];
}

function compact(value) {
  return Number(value.toFixed(6));
}

if (!fs.existsSync(OEM_FILE)) {
  throw new Error(`Missing OEM file: ${OEM_FILE}`);
}

const states = parseOem(fs.readFileSync(OEM_FILE, "utf8"));
if (states.length < 10) {
  throw new Error(`OEM parser found only ${states.length} usable states`);
}

let maxEarth = { km: 0, epoch: states[0].epoch };
let minMoon = { km: Number.POSITIVE_INFINITY, epoch: states[0].epoch };

const samples = states.map((state) => {
  const date = new Date(state.t);
  const moon = astroVectorKm(Astronomy.Body.Moon, date);
  const sun = astroVectorKm(Astronomy.Body.Sun, date);
  const earthDistance = mag(state.r);
  const moonDistance = mag(sub(state.r, moon));
  const speed = mag(state.v);

  if (earthDistance > maxEarth.km) maxEarth = { km: earthDistance, epoch: state.epoch };
  if (moonDistance < minMoon.km) minMoon = { km: moonDistance, epoch: state.epoch };

  return {
    t: state.t,
    epoch: state.epoch,
    r: state.r.map(compact),
    v: state.v.map(compact),
    moon: moon.map((value) => Number(value.toFixed(3))),
    sun: sun.map((value) => Number(value.toFixed(3))),
    earthDistanceKm: Number(earthDistance.toFixed(3)),
    moonDistanceKm: Number(moonDistance.toFixed(3)),
    speedKms: Number(speed.toFixed(6)),
  };
});

const mission = {
  meta: {
    name: "Artemis II / Orion Integrity",
    coordinateFrame: "Earth-centered EME2000/J2000, kilometers and kilometers per second",
    launchTime: "2026-04-01T22:35:00Z",
    ephemerisStart: samples[0].epoch + "Z",
    entryInterface: samples[samples.length - 1].epoch + "Z",
    splashdownTime: "2026-04-11T00:07:27Z",
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    stats: {
      maxEarthDistanceKmFromOem: Number(maxEarth.km.toFixed(3)),
      maxEarthDistanceEpochFromOem: maxEarth.epoch + "Z",
      minMoonCenterDistanceKmComputed: Number(minMoon.km.toFixed(3)),
      minMoonDistanceEpochComputed: minMoon.epoch + "Z",
      nasaReportedTotalDistanceMiles: 694481,
      nasaReportedMaxEarthDistanceMiles: 252756,
      nasaReportedClosestMoonAltitudeMiles: 4067,
    },
  },
  constants: {
    earthRadiusKm: 6371,
    moonRadiusKm: 1737.4,
    kmToScene: 1 / 6371,
  },
  events: [
    {
      id: "launch",
      time: "2026-04-01T22:35:00Z",
      phase: "Launch",
      title: "LC-39B 발사",
      body: "SLS Block 1과 Orion Integrity가 케네디 우주센터 39B에서 이륙했다.",
      source: "NASA FAQ / launch update",
    },
    {
      id: "earth-orbit",
      time: "2026-04-02T01:57:37Z",
      phase: "Earth orbit",
      title: "상단 분리와 근접 운용",
      body: "ICPS를 표적으로 삼아 약 70분간 수동 조종 특성을 확인하는 시점이다.",
      source: "NASA proximity operations article / OEM start",
    },
    {
      id: "tli",
      time: "2026-04-02T23:49:00Z",
      phase: "Trans-lunar injection",
      title: "TLI 점화",
      body: "Orion 주 엔진이 약 5분 50초 점화되어 자유귀환 궤도로 진입했다.",
      source: "NASA Flight Day 2 update",
    },
    {
      id: "outbound",
      time: "2026-04-04T12:00:00Z",
      phase: "Outbound coast",
      title: "달 전이 순항",
      body: "지구권을 벗어나며 생명유지, 운동, 통신, 항법 절차를 계속 점검한다.",
      source: "NASA press kit / mission blog",
    },
    {
      id: "record",
      time: "2026-04-06T17:56:00Z",
      phase: "Lunar approach",
      title: "인류 최장 거리 기록 돌파",
      body: "Apollo 13의 지구 거리 기록을 넘어선 뒤 달 관측 구간으로 들어간다.",
      source: "NASA FAQ",
    },
    {
      id: "observation",
      time: "2026-04-06T18:45:00Z",
      phase: "Lunar science",
      title: "7시간 달 관측 시작",
      body: "창문을 교대로 사용하며 Orientale Basin, 용암 평원, 충돌구와 지형 색 변화를 기록한다.",
      source: "NASA FAQ / CSA science",
    },
    {
      id: "blackout",
      time: "2026-04-06T22:44:00Z",
      phase: "Far-side blackout",
      title: "달 뒤 통신 두절",
      body: "Orion이 달 뒤를 지나는 동안 약 40분간 지구와의 통신이 차단된다.",
      source: "NASA FAQ",
    },
    {
      id: "closest",
      time: "2026-04-06T23:00:00Z",
      phase: "Closest approach",
      title: "달 최근접",
      body: "달 표면 약 4,067마일 고도에서 달 중력으로 궤적이 지구 귀환 방향으로 휘어진다.",
      source: "NASA FAQ",
    },
    {
      id: "eclipse",
      time: "2026-04-07T00:35:00Z",
      phase: "Solar eclipse",
      title: "달에 의한 태양식",
      body: "Orion 관점에서 달이 태양을 가리며 코로나와 어두운 달 표면 관측 기회가 생긴다.",
      source: "NASA Flight Day 2 update / FAQ",
    },
    {
      id: "return",
      time: "2026-04-07T12:00:00Z",
      phase: "Trans-Earth return",
      title: "지구 귀환 순항",
      body: "자유귀환 궤도와 소규모 보정 점화로 진입 조건을 맞추며 지구로 돌아온다.",
      source: "NASA press kit / NTRS AAS 23-062",
    },
    {
      id: "rtc3",
      time: "2026-04-10T18:53:00Z",
      phase: "Return correction",
      title: "최종 귀환 보정 점화",
      body: "8초 점화로 약 4.2 ft/s의 속도 변화를 주어 진입 경로를 미세 조정했다.",
      source: "NASA Flight Day 10 update",
    },
    {
      id: "service-sep",
      time: "2026-04-10T23:33:00Z",
      phase: "Entry setup",
      title: "서비스 모듈 분리",
      body: "재진입 전 서비스 모듈을 분리하고 crew module만 대기권 진입을 준비한다.",
      source: "NASA Flight Day 9 update",
    },
    {
      id: "entry",
      time: "2026-04-10T23:53:00Z",
      phase: "Entry interface",
      title: "대기권 진입",
      body: "고도 약 400,000 ft에서 최대 약 23,864 mph 속도로 진입하며 플라즈마 통신 두절이 시작된다.",
      source: "NASA Flight Day 9 update",
    },
    {
      id: "splashdown",
      time: "2026-04-11T00:07:27Z",
      phase: "Splashdown",
      title: "태평양 착수",
      body: "샌디에이고 해상에 착수 후 회수팀이 승무원을 USS John P. Murtha로 이송했다.",
      source: "NASA mission page / Flight Day 10 update",
    },
  ],
  sources: [
    {
      title: "NASA AROW Artemis II Ephemeris",
      url: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
    },
    {
      title: "NASA SVS Artemis II mission trajectory",
      url: "https://svs.gsfc.nasa.gov/5632/",
    },
    {
      title: "NASA Artemis II mission page",
      url: "https://www.nasa.gov/mission/artemis-ii/",
    },
    {
      title: "NASA Artemis II Press Kit",
      url: "https://www.nasa.gov/artemis-ii-press-kit/",
    },
    {
      title: "NTRS AAS 23-062 trajectory correction burn placement",
      url: "https://ntrs.nasa.gov/citations/20230000223",
    },
    {
      title: "NASA Orion spacecraft components",
      url: "https://www.nasa.gov/reference/spacecraft-components/",
    },
    {
      title: "NASA Crew Systems / OCSS",
      url: "https://www.nasa.gov/reference/crew-systems/",
    },
    {
      title: "Canadian Space Agency Artemis II science",
      url: "https://www.asc-csa.gc.ca/eng/missions/artemis-ii/scientific-research-during-mission.asp",
    },
  ],
  samples,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(mission));
console.log(`Wrote ${OUT_FILE}`);
console.log(`Samples: ${samples.length}`);
console.log(`OEM max Earth distance: ${mission.meta.stats.maxEarthDistanceKmFromOem} km`);
console.log(`Computed min Moon-center distance: ${mission.meta.stats.minMoonCenterDistanceKmComputed} km`);
