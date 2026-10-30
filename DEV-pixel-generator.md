# DEV: Pixel Generator — 개발 설계서

- **작성일**: 2026-10-28
- **근거 문서**: brainstorm.md, PRD-pixel-generator.md, DESIGN-pixel-generator.md
- **대상 독자**: 이 프로젝트를 구현하는 개발자 (AI 코딩 도구에 넘기는 기준 문서로도 사용)
- **표기**: 세 문서에 없고 이 문서에서 새로 정한 것은 **[결정]**, 아직 확인이 필요한 것은 **[가정]**으로 표시했다.

---

## 0. 한 줄 결론

**서버 없는 단일 페이지 웹앱(SPA) 하나, 의존성은 개발 도구뿐, 로직은 `core/`의 순수 함수에 모은다.**
4일짜리 1인 MVP에 백엔드, 프레임워크, 상태관리 라이브러리를 들이면 설계보다 설정에 시간을 더 쓴다. 대신 "나중에 커져도 갈아엎지 않아도 되는 경계선" 세 개만 처음부터 지킨다.

| 경계선 | 지키는 이유 |
|--------|-----------|
| `core/`는 DOM을 모른다 | 테스트가 쉽고, 나중에 Web Worker로 옮길 때 코드를 그대로 쓸 수 있다 |
| 편집기는 `PixelEditor` 하나 | 같은 편집 기능을 화면 3곳에서 따로 만들면 일정이 깨진다 (brainstorm Top 1) |
| 시트 생성기의 입력은 "이미지 한 장짜리 프레임 목록" | 수동 애니메이션과 v2 AI 애니메이션(Pixellab)이 같은 시트 생성기를 쓸 수 있다 |

## 1. 규모 판단

| 항목 | 값 | 설계에 주는 영향 |
|------|----|----------------|
| 기간 | 4일 | 새로 배워야 하는 기술 금지 |
| 인원 | 1명 **[가정]** | 모듈 분리는 "협업"이 아니라 "AI 도구와 나에게 범위를 좁혀 주기" 위한 것 |
| 사용자 | 데스크톱 브라우저, 동시 접속 개념 없음 | 서버·DB·인증 불필요 |
| 데이터 크기 | 픽셀 아트 최대 256×256 **[결정]**, 레이어 10, 프레임 32 | 전부 메모리에 올려도 수 MB 수준. 최적화보다 단순함 우선 |
| 배포 | Netlify 정적 호스팅 | `dist/` 폴더만 올리면 끝 |

> **"직접 입력" 해상도 상한 256px [결정]**: brainstorm에는 상한이 없었다. 256×256 한 장은 약 0.26MB라, 레이어 10장 + 직접 고친 프레임 32장을 모두 들고 있어도 약 11MB로 브라우저가 충분히 버틸 수 있고, v2 Pixellab 입력 상한(대부분 256px)과도 맞는다.

## 2. 기술 스택

| 영역 | 선택 | 이유 / 대안 |
|------|------|-----------|
| 빌드 | Vite | 설정이 거의 없고 빠르다 |
| 언어 | TypeScript (strict) | 픽셀 좌표, 버퍼 크기 실수를 컴파일 단계에서 잡는다 |
| UI | 프레임워크 없음 + 작은 `h()` 헬퍼 | brainstorm 결정. 화면 4개, 상태 단순. UI 코드가 300줄 넘게 꼬이면 Preact로 교체 (`ui/`만 바뀜) |
| 그리기 | Canvas 2D API | 픽셀 단위 조작에 충분 |
| 테스트 | Vitest **[결정]** | Vite와 설정 공유, `core/` 단위 테스트용 |
| 품질 | ESLint + Prettier | 커밋 전 자동 정리 |
| 런타임 의존성 | **0개** | 공급망 위험과 CSP 문제를 원천 차단 |

## 3. 전체 구조

### 3.1 계층

```
┌──────────────────────────────────────────────┐
│ ui/        화면, 버튼, 패널 (DOM만 다룸)        │
├──────────────────────────────────────────────┤
│ editor/    PixelEditor: 마우스·키보드 → 픽셀 편집 │
├──────────────────────────────────────────────┤
│ state/     store: 앱 상태 하나 + 변경 함수들      │
├──────────────────────────────────────────────┤
│ core/      순수 함수: 변환, 레이어, 애니메이션, 시트 │  ← DOM 없음, 테스트 대상
├──────────────────────────────────────────────┤
│ io/ · security/  파일 검증·읽기·내보내기          │
└──────────────────────────────────────────────┘
```

의존 방향은 **위 → 아래만** 허용한다. `core/`가 `ui/`를 import하면 안 된다.

### 3.2 데이터 흐름 (사용자 흐름 그대로)

```
[파일 / 자유 그리기 캔버스]
        │ security/validateFile → io/loadImage
        ▼
   source: PixelBuffer (원본, 최대 4096px)
        │ core/pixelate(source, options)       ← "변환하기" 버튼
        ▼
   base: PixelBuffer (예: 32×32) + palette
        │ 사용자가 편집 (PixelEditor)
        │ core/layers.cutToLayer(영역)           ← ② 단계
        ▼
   layers: Layer[]
        │ core/animate.applyPreset / 직접 편집
        ▼
   frames: Frame[]  (레이어별 위치·표시 여부)
        │ core/compose.renderFrame(각 프레임)
        ▼
   frameImages: PixelBuffer[]  ← ③에서 직접 수정하면 이 이미지가 "확정"됨
        │ core/spritesheet.build
        ▼
   sheet: PixelBuffer + meta JSON  →  io/exportPng
```

## 4. 데이터 모델

### 4.1 핵심 결정: `ImageData` 대신 `PixelBuffer` [결정]

브라우저의 `ImageData`는 Node(테스트 환경)에 없다. `core/`는 같은 모양의 평범한 객체를 쓰고, 화면에 그릴 때만 `ImageData`로 바꾼다.

```ts
// core/types.ts
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, 길이 = width * height * 4
}

export type RGBA = readonly [r: number, g: number, b: number, a: number];

export interface Layer {
  id: string;
  name: string;           // "머리", "팔"
  tag: number;            // 색 태그 인덱스 (DESIGN A4: 6색 세트)
  pixels: PixelBuffer;    // 캔버스와 같은 크기. 빈 곳은 투명
  visible: boolean;       // 편집 화면에서의 표시 여부 (눈 아이콘)
}

export interface LayerPose {
  layerId: string;
  dx: number;             // 정수 픽셀만 (픽셀 아트 선명도 유지)
  dy: number;
  visible: boolean;       // "깜빡임" 프리셋용
}

export interface Frame {
  id: string;
  poses: LayerPose[];
  baked?: PixelBuffer;    // ③에서 직접 고친 프레임. 있으면 poses보다 우선
}

export interface Project {
  width: number;          // 픽셀 아트 해상도
  height: number;
  palette: RGBA[];
  layers: Layer[];
  frames: Frame[];
  fps: number;
}
```

### 4.2 왜 `Frame.baked`가 필요한가

brainstorm에는 두 요구가 부딪힌다.

- 기능 5: 프레임 = **레이어 위치 조합** (조금씩 옮겨 애니메이션 만들기)
- 기능 7: 시트에서 프레임 하나를 골라 **픽셀을 직접 수정**

위치 조합만으로는 "3번 프레임의 팔만 한 픽셀 고치기"를 표현할 수 없다. 그래서 ③에서 프레임을 수정하는 순간 그 프레임을 이미지 한 장(`baked`)으로 확정한다.

| | 장점 | 대가 |
|---|---|---|
| `baked` 방식 (선택) | 모델이 단순, v2 AI 프레임(이미지 한 장)도 같은 필드에 넣으면 됨 | 확정된 프레임은 ②로 돌아가 레이어를 바꿔도 자동 반영 안 됨 → UI에서 "직접 고친 프레임은 레이어 변경이 반영되지 않아요" 안내 |
| 프레임마다 레이어 전체 복사 | ②에서 계속 편집 가능 | 메모리 10배, 구현 복잡 → 4일에 부적합 |

### 4.3 앱 상태

```ts
// state/store.ts
export type Step = 'start' | 'draw' | 'convert' | 'animate' | 'sheet';

export interface AppState {
  step: Step;
  source: PixelBuffer | null;          // 원본 (보기 전용)
  convertOptions: ConvertOptions;
  project: Project | null;             // "변환하기" 후 생김
  editedSinceConvert: boolean;         // 다시 변환 시 확인 창 띄울지
  selectedLayerId: string | null;
  selectedFrameId: string | null;
}
```

- store는 `getState()`, `setState(patch)`, `subscribe(listener)` 세 개만 가진 30줄짜리 직접 구현 **[결정]**.
- 상태 변경은 `state/actions.ts`의 함수로만 한다 (예: `convert()`, `cutToLayer()`, `applyPreset()`). UI가 상태를 직접 고치지 않는다.

## 5. 폴더 구조

```
pixel-generator/
├─ index.html
├─ netlify.toml                 # 빌드 설정 + 보안 헤더
├─ package.json / tsconfig.json / vite.config.ts
├─ public/
│  └─ fonts/                    # Galmuri11, Pretendard (self-host, CSP 때문)
├─ src/
│  ├─ main.ts                   # 진입점: store 생성, 첫 화면 렌더
│  ├─ config/
│  │  └─ constants.ts           # MAX_* 상수 전부 여기
│  ├─ core/                     # ★ DOM 금지, 전부 순수 함수
│  │  ├─ types.ts
│  │  ├─ buffer.ts              # create / clone / getPixel / setPixel / blit
│  │  ├─ color.ts               # RGB↔HSL, 색 거리
│  │  ├─ downscale.ts           # 영역 평균 축소
│  │  ├─ quantize.ts            # median-cut → palette
│  │  ├─ hueShift.ts            # 팔레트 램프 색조 이동
│  │  ├─ dither.ts              # none / bayer / floydSteinberg
│  │  ├─ cleanup.ts             # 외톨이 픽셀 제거
│  │  ├─ pixelate.ts            # 위 단계를 순서대로 엮는 파이프라인
│  │  ├─ guides.ts              # Banding / Pillow Shading 감지 (컷 1순위)
│  │  ├─ fill.ts                # 채우기(flood fill)
│  │  ├─ layers.ts              # 영역(마스크) → 새 레이어로 잘라내기
│  │  ├─ animate.ts             # 프리셋 → LayerPose[][]
│  │  ├─ compose.ts             # Frame → PixelBuffer
│  │  └─ spritesheet.ts         # PixelBuffer[] → 시트 + meta
│  ├─ editor/
│  │  ├─ PixelEditor.ts         # 화면 4곳에서 재사용하는 편집기
│  │  ├─ tools.ts               # pencil / eraser / fill / eyedropper / brush(자유 그리기)
│  │  ├─ history.ts             # Undo/Redo (변경 영역만 저장)
│  │  ├─ viewport.ts            # 확대·이동, 화면 좌표 → 픽셀 좌표
│  │  └─ shortcuts.ts           # B, E, G, I, Ctrl+Z, Ctrl+Shift+Z, Space
│  ├─ state/
│  │  ├─ store.ts
│  │  └─ actions.ts
│  ├─ security/
│  │  └─ validateFile.ts        # 형식·크기 검증만 담당
│  ├─ io/
│  │  ├─ loadImage.ts           # File → PixelBuffer (EXIF 자동 제거)
│  │  └─ exportPng.ts           # PixelBuffer → 다운로드
│  ├─ ui/
│  │  ├─ dom.ts                 # h() 헬퍼: createElement + textContent만 사용
│  │  ├─ render.ts              # PixelBuffer → <canvas> 그리기
│  │  ├─ components/            # stepBar, toolbar, principlesPanel, layerList,
│  │  │                         # timeline, dialog, toast, statusBar
│  │  └─ screens/               # start, draw, convert, animate, sheet
│  └─ styles/
│     ├─ tokens.css             # DESIGN A3 색·글꼴·간격 토큰
│     ├─ base.css
│     └─ screens.css
└─ tests/
   └─ core/                     # quantize, dither, spritesheet, layers, animate 등
```

brainstorm의 파일 구조를 기본으로 하되 `buffer.ts`, `color.ts`, `downscale.ts`, `fill.ts`, `compose.ts`, `guides.ts`, `state/`, `io/`를 추가했다. 각각 "한 파일 한 가지 일" 규칙을 지키려고 나눈 것이다.

## 6. 모듈별 설계

### 6.1 변환 파이프라인 `core/pixelate.ts`

```ts
export interface ConvertOptions {
  width: number; height: number;       // 8, 16, 32, 64, 직접 입력(≤256)
  colors: number;                      // 4~32
  dither: 'none' | 'bayer' | 'floyd-steinberg';
  hueShift: boolean;
  cleanup: boolean;                    // Pixel Clusters / Jaggies
}

export function pixelate(src: PixelBuffer, opt: ConvertOptions):
  { image: PixelBuffer; palette: RGBA[] } {
  const small   = downscale(src, opt.width, opt.height);
  let palette   = quantize(small, opt.colors);
  if (opt.hueShift) palette = hueShift(palette);
  let image     = dither(small, palette, opt.dither);   // 팔레트 색으로 매핑
  if (opt.cleanup) image = cleanup(image);
  return { image, palette };
}
```

| 단계 | 방법 | 주의점 |
|------|------|-------|
| downscale | 목표 픽셀 하나에 들어가는 원본 영역의 **평균색** | 브라우저 `drawImage` 축소는 브라우저마다 결과가 달라 "같은 입력 → 같은 결과" 원칙이 깨진다. 직접 계산한다 |
| 비율 | 원본 비율과 목표 비율이 다르면 **자르지 않고** 비율을 지켜 가운데에 넣고, 남는 부분은 **투명 여백**으로 둠 **[결정, 사용자 요청으로 변경]** | 그림이 잘리지 않고 캐릭터도 늘어나지 않는다. 내용 크기는 정수 픽셀로 반올림(`core/contain.ts`) |
| 투명도 | 알파 128 미만은 완전 투명, 이상은 불투명으로 | 픽셀 아트에 반투명 픽셀을 남기지 않음 |
| quantize | median-cut, 불투명 픽셀만 대상 | 결과 순서를 밝기순으로 정렬해 팔레트 UI를 보기 좋게 |
| hueShift | 밝기 순 팔레트에서 어두운 색은 파랑 쪽, 밝은 색은 노랑 쪽으로 색조 이동 (최대 ±15° **[결정]**) | 값은 Day 1에 눈으로 보고 조정 |
| dither | Bayer 4×4 / Floyd-Steinberg | FS는 오차가 투명 픽셀로 번지지 않게 막는다 |
| cleanup | 상하좌우 4칸이 모두 다른 같은 색인 외톨이 픽셀 → 주변 최빈색으로 | 의도한 점(눈동자)이 지워질 수 있어 옵션 OFF 가능 |
| Anti-Aliasing | 기본 OFF = 아무 처리 안 함 | 코드 없음. 원칙 패널에 설명만 |

**가장 위험한 가정** (PRD 7.4): "결과가 쓸 만큼 예쁜가". Day 1 오전에 `pixelate`만 먼저 만들어 사진 5장으로 확인한다. 별로면 Day 1 오후를 이 알고리즘 조정에 쓰고, 그 시간만큼 PRD 컷 기준을 적용한다.

### 6.2 편집기 `editor/PixelEditor.ts`

```ts
export interface EditorOptions {
  mode: 'pixel' | 'freehand';  // pixel: 격자 단위 / freehand: 512×512 자유 그리기
  readOnly?: boolean;          // ① 원본 칸
  onChange?: (buf: PixelBuffer) => void;
}

export class PixelEditor {
  constructor(host: HTMLElement, target: PixelBuffer, opt: EditorOptions);
  setTarget(buf: PixelBuffer): void;   // 레이어·프레임 바꿀 때
  setTool(tool: ToolName): void;
  setColor(c: RGBA): void;
  undo(): void; redo(): void;
  destroy(): void;                      // 화면 떠날 때 이벤트 해제
}
```

| 쓰는 곳 | mode | target |
|---------|------|--------|
| 직접 그리기 | freehand | 512×512 빈 버퍼 |
| ① 변환 결과 | pixel | `project` 기본 레이어 |
| ② 레이어 편집 | pixel | 선택한 레이어의 `pixels` |
| ③ 프레임 확대 모달 | pixel | 프레임 이미지 (수정 시 `baked`) |

- **도구**: pixel 모드는 픽셀 하나씩 (빠르게 움직여도 끊기지 않게 직전 점과 직선으로 이음). freehand 모드의 펜은 Canvas `lineTo` + 굵기 옵션.
- **좌표 변환**은 `viewport.ts` 한 곳에서만: `화면 좌표 → (빼기 이동량) → (나누기 배율) → 내림` = 픽셀 좌표. 이 계산이 여기저기 흩어지면 확대 상태에서 한 칸씩 어긋나는 버그가 생긴다.
- **확대**: 정수 배율만 (1×~32×), `image-rendering: pixelated`. 휠로 확대, Space+드래그로 이동.
- **Undo**: 한 번의 붓질(마우스 누름~뗌)이 하나의 기록. 바뀐 사각형 영역의 전/후 픽셀만 저장 **[결정]**. 512×512 자유 그리기에서 화면 전체를 50번 저장하면 50MB가 되기 때문. 상한 50개 (`MAX_UNDO`).

### 6.3 레이어 `core/layers.ts`

```ts
export type Mask = { width: number; height: number; bits: Uint8Array }; // 1 = 선택
export function rectMask(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask;
export function lassoMask(w: number, h: number, points: [number, number][]): Mask; // 다각형 내부 판정
export function cutToLayer(src: Layer, mask: Mask, name: string): { rest: Layer; cut: Layer };
```

- 잘라낸 픽셀은 새 레이어로 옮기고 원래 레이어에서는 투명으로 비운다 ("잘라내기").
- 모든 레이어는 캔버스와 같은 크기. 위치 차이는 `LayerPose.dx/dy`로만 표현한다.
- **컷 기준** (PRD 8): Day 2 끝에 안 되면 `rectMask`를 4등분 고정 영역으로 대체 (`quadMasks()` 함수 하나 추가).

### 6.4 애니메이션 `core/animate.ts`

```ts
export type Preset = 'bob' | 'sway' | 'jump' | 'blink';
export function presetPoses(p: Preset, layerId: string, frameCount: number, amp = 2): LayerPose[];
```

| 프리셋 | 프레임 i (총 N) 계산 |
|--------|---------------------|
| bob (상하 흔들림) | `dy = round(sin(2π·i/N) · amp)` |
| sway (좌우) | `dx = round(sin(2π·i/N) · amp)` |
| jump (점프) | `dy = -round(max(0, sin(2π·i/N)) · amp · 2)` (위로만) |
| blink (깜빡임) | `visible = i !== N-1` (마지막 프레임만 숨김) |

- 반올림을 거쳐 **항상 정수**. 회전은 픽셀이 깨지므로 넣지 않는다 (brainstorm 결정).
- 프리셋 적용 = 선택한 레이어의 `poses`만 덮어쓰기. 다른 레이어의 포즈는 그대로.

### 6.5 프레임 합성 `core/compose.ts`

```ts
export function renderFrame(project: Project, frame: Frame): PixelBuffer {
  if (frame.baked) return frame.baked;
  // 빈 버퍼에 layers 순서대로, 해당 pose의 dx/dy만큼 밀어서 덮어 그림
  // 캔버스 밖으로 나간 픽셀은 버림 (잘림)
}
```

### 6.6 스프라이트 시트 `core/spritesheet.ts`

```ts
export interface SheetMeta {
  frameWidth: number; frameHeight: number;
  frameCount: number; columns: number; rows: number; fps: number;
}
export function buildSheet(frames: PixelBuffer[], fps: number, columns = Math.min(frames.length, 4)):
  { sheet: PixelBuffer; meta: SheetMeta };
```

- 기본 4열 **[결정]**: DESIGN 예시(32×32 × 8개 → 4열 2행 = 128×64)와 맞춤. 열 수는 나중에 옵션으로 열 수 있게 매개변수로 둔다.
- 프레임 간 여백 0px (게임 엔진이 칸 크기만으로 자를 수 있게).
- 테스트 필수: `시트 너비 = 프레임 너비 × 열`, `높이 = 프레임 높이 × ceil(개수/열)`, 각 칸의 픽셀이 원본 프레임과 같음.

### 6.7 원칙 가이드 감지 `core/guides.ts` (선택)

- Banding: 같은 방향으로 3칸 이상 나란히 이어지는 색 경계 줄을 찾아 영역 반환.
- Pillow Shading: 윤곽을 따라 가장자리는 어둡고 가운데로 갈수록 동심원처럼 밝아지는 패턴을 찾아 영역 반환.
- **컷 1순위**: 감지가 부정확하거나 일정이 밀리면 이 파일을 만들지 않고 원칙 패널에 설명 + 예시 이미지만 둔다 (PRD 컷 기준). UI는 처음부터 "결과 없음"을 처리하게 만들어 두면 빼도 깨지지 않는다.

### 6.8 UI 렌더링 방식

- 화면 전환 = `step` 상태가 바뀌면 현재 화면의 `destroy()` 호출 → 새 화면 `mount()`. 화면 안에서는 필요한 부분만 다시 그린다.
- 모든 DOM은 `h('button', { onClick }, '변환하기')` 형태로 만든다. 글자는 `textContent`로만 넣는다. **`innerHTML` 사용 금지** (보안 규칙, ESLint로 막음).
- 문구는 DESIGN A6 표를 `ui/copy.ts` 한 파일에 모아 둔다 **[결정]**. 같은 행동의 이름이 화면마다 달라지는 실수를 막는다.

## 7. 보안 설계

brainstorm 보안 체크리스트를 코드 위치에 대응시켰다.

| 위험 | 대응 | 위치 |
|------|------|------|
| 위장 파일 | 파일 앞부분 바이트(매직 바이트) 확인. PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`. 확장자·MIME은 참고만 | `security/validateFile.ts` |
| 거대 파일 | 10MB 초과 거부 → 디코딩 후 4096px 초과면 축소하고 안내 | `validateFile.ts`, `loadImage.ts` |
| SVG 스크립트 | SVG 허용 안 함 (매직 바이트 목록에 없음) | `validateFile.ts` |
| 개인 사진 유출 | 네트워크 요청 코드 없음. CSP `connect-src 'none'`으로 강제 | `netlify.toml` |
| EXIF 위치정보 | `createImageBitmap` → 캔버스로 다시 그려서 메타데이터 버림 | `loadImage.ts` |
| 메모리 폭주 | `MAX_UNDO 50`, `MAX_FRAMES 32`, `MAX_LAYERS 10`, `MAX_ART_SIZE 256` | `config/constants.ts` |
| 스크립트 주입 | `innerHTML` 금지, 런타임 의존성 0개 | ESLint 규칙 |
| 다운로드 파일명 | 사용자 입력을 쓰지 않고 `sprite-{timestamp}.png` 고정 | `io/exportPng.ts` |
| **API 키 노출 (v2 Pixellab)** | **절대 노출 금지.** 키는 Netlify 환경 변수에만 두고 Netlify Functions 안에서만 읽는다. 브라우저 코드, Git 저장소, `.env` 커밋, 응답 본문, 로그 어디에도 넣지 않는다 (12.1 참고) | `netlify/functions/` |

```ts
// config/constants.ts
export const MAX_FILE_BYTES   = 10 * 1024 * 1024;
export const MAX_SOURCE_SIZE  = 4096;
export const MAX_ART_SIZE     = 256;
export const FREEHAND_SIZE    = 512;
export const MAX_LAYERS       = 10;
export const MAX_FRAMES       = 32;
export const MAX_UNDO         = 50;
export const ART_SIZE_PRESETS = [8, 16, 32, 64] as const;
```

## 8. 배포 설정

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
```

- (2026-10-29 변경) Pixellab 연결 확인 기능을 붙이면서 `connect-src 'self'`로 열었다. 브라우저는 우리 사이트의 `/.netlify/functions/*`로만 요청할 수 있다. 로컬 `npm run dev`에서는 `vite.config.ts`의 `netlifyFunctionsDev` 플러그인이 같은 함수를 대신 실행한다.
- (변경 전) `connect-src 'none'`: 앱이 어디로도 데이터를 보내지 못하게 막는다. "사진이 기기 밖으로 나가지 않아요" 문구를 **설정으로 보증**하는 장치다. v2에서 Pixellab을 붙일 때 `'self'`(Netlify Functions)로만 연다 (12.1 참고).
- CSP는 Netlify 대시보드가 아니라 저장소의 `netlify.toml`에서 고친다. 반대로 **API 키는 `netlify.toml`에 쓰지 않고 Netlify 대시보드의 환경 변수에만** 넣는다.
- 배포 후 브라우저 개발자 도구 콘솔에 CSP 오류가 없는지 반드시 확인한다 (Day 4 체크리스트).
- Git 저장소 연결 → push마다 자동 배포, PR마다 미리보기 URL.

## 9. 테스트 전략

규모에 맞게 **`core/`만 자동 테스트**, UI는 시나리오 수동 확인.

| 대상 | 확인할 것 |
|------|----------|
| `downscale` | 단색 이미지 → 단색 결과, 결과 크기 정확 |
| `quantize` | 색 수 ≤ 요청 수, 같은 입력 → 같은 팔레트 (결정성) |
| `dither` | 결과 픽셀이 전부 팔레트 안의 색, 투명 픽셀 유지 |
| `cleanup` | 외톨이 픽셀 하나가 주변색으로 바뀜 |
| `cutToLayer` | 잘라낸 픽셀 수 = 원래 레이어에서 사라진 픽셀 수 |
| `presetPoses` | 모든 dx/dy가 정수, 프레임 수 일치 |
| `buildSheet` | 시트 크기 공식, 각 칸 픽셀 일치 |
| `validateFile` | PNG 확장자를 단 텍스트 파일 거부, 10MB+1바이트 거부 |

**수동 시나리오 (매일 끝에 1회)**: 사진 업로드 → 32×32 변환 → 팔 영역 잘라 레이어 → bob 프리셋 8프레임 → 시트에서 3번 프레임 수정 → PNG 내보내기 → 파일을 열어 128×64인지 확인.

## 10. 4일 작업 계획 (파일 단위)

| 일차 | 오전 | 오후 | 끝났다는 기준 |
|------|------|------|-------------|
| **Day 1** | 프로젝트 세팅, `types`·`buffer`·`color`, `downscale`·`quantize`·`dither`·`pixelate` + 테스트, **사진 5장으로 결과 품질 확인** | `validateFile`·`loadImage`, 시작 화면·① 변환 화면(좌우 칸, 옵션 줄, 변환하기), `tokens.css`, 직접 그리기(가능하면) | 이미지 넣고 "변환하기" → 오른쪽에 픽셀 결과 |
| **Day 2** | `PixelEditor`·`tools`·`history`·`viewport`·`shortcuts`, `fill` | `layers`(사각형 → 올가미), ② 화면의 레이어 목록, `hueShift`·`cleanup`, 원칙 패널 | 영역을 잘라 레이어로 만들고 편집됨 |
| **Day 3** | `animate`·`compose`, 타임라인, 프리셋 탭 | `spritesheet` + 테스트, ③ 화면, 미리보기 재생(FPS) | 시트 한 장과 재생 미리보기가 나옴 |
| **Day 4** | 프레임 확대 모달(`baked`), `exportPng`(+meta JSON), 상태·문구(DESIGN A6·A7), 새로고침 경고 | `netlify.toml` 배포, CSP 확인, 수동 시나리오, 버그 수정. 시간이 남으면 `guides` | 배포 URL에서 처음부터 끝까지 한 번에 동작 |

### 일정이 밀릴 때 (PRD 컷 기준을 코드에 대응)

| 상황 | 자를 것 | 코드 영향 |
|------|--------|---------|
| Day 1 밀림 | 직접 그리기를 Day 2 편집기 작업과 합침 | `PixelEditor` freehand 모드를 Day 2에 같이 |
| Day 2 끝에 레이어 미완 | 올가미 → 고정 4분할 | `quadMasks()`로 대체 |
| Day 3에 시트 미완 | 프리셋 4 → 2개 (bob, blink) | `presetPoses` 분기 2개 삭제 |
| 가이드 감지 부정확 | `guides.ts` 생략 | 원칙 패널 설명만 |
| 항상 먼저 | Limited Palette + Dithering | Day 1 오전에 이미 완료 |

## 11. 코드 규칙

- 함수 하나 = 일 하나. 50줄을 넘으면 나눌 곳을 찾는다.
- 숫자 상수는 이름을 붙여 `constants.ts`에. (`if (frames.length >= 32)` ✕ → `>= MAX_FRAMES` ○)
- `core/` 함수는 입력을 고치지 않고 새 버퍼를 돌려준다. 단, `PixelEditor` 안의 실시간 붓질은 성능 때문에 대상 버퍼를 직접 고친다 (Undo 기록이 있으므로 안전).
- 파일 이름: 함수 모음은 `camelCase.ts`, 클래스는 `PascalCase.ts`.
- 커밋은 작업 단위로 작게. 메시지는 `feat: 디더링 Bayer 추가`처럼 유형 + 한 줄.

## 12. 나중에 커질 때 (v2 대비)

| 변화 | 지금 해 둔 준비 | 그때 할 일 |
|------|---------------|----------|
| 큰 이미지에서 화면 멈춤 | `pixelate`가 DOM 없는 순수 함수 | `core/`를 그대로 Web Worker에서 호출 |
| Pixellab AI 애니메이션 | 프레임에 이미지 한 장(`baked`)을 넣을 수 있음 | `netlify/functions/pixellab-start.ts`, `pixellab-status.ts` 추가(작업 시작/상태 조회 분리), CSP `connect-src 'self'`, 외부 전송 동의 화면 |
| 프로젝트 저장/불러오기 | `Project`가 평범한 데이터 | JSON 직렬화 + 스키마 검증 + 상한 검사 |
| UI 복잡도 증가 | 상태 변경이 `actions.ts`에 모여 있음 | `ui/`만 Preact로 교체 |
| GIF 내보내기 | `renderFrame`으로 프레임 이미지 목록을 이미 만듦 | 인코더 추가 (런타임 의존성 1개 생김 → 검토) |

### 12.1 Pixellab AI 애니메이션 [결정]

픽셀 변환 결과(또는 직접 고친 결과)를 Pixellab에 보내 애니메이션 프레임을 받는다.

**API 키는 절대 노출하지 않는다 (가장 먼저 지킬 규칙)**

- 키는 **Netlify 대시보드의 환경 변수**(`PIXELLAB_API_KEY`)에만 저장한다. 코드와 Git 저장소에는 넣지 않는다.
- 키를 읽는 곳은 `netlify/functions/` 안의 함수뿐이다. `src/`(브라우저 코드)에서는 Pixellab 주소를 직접 부르지 않는다.
- `VITE_`로 시작하는 환경 변수에 키를 넣지 않는다. Vite가 브라우저 번들에 그대로 넣어 버린다.
- 함수는 Pixellab 응답 중 프레임 이미지와 상태만 골라 돌려준다. 키, 요청 헤더, Pixellab 원본 에러 본문을 브라우저로 넘기거나 로그에 남기지 않는다.
- 로컬 개발은 `.env`(`.gitignore`에 포함)와 `netlify dev`로 한다. 배포 전 `dist/`에서 키 문자열이 검색되지 않는지 확인한다.

**구조: Netlify Functions 프록시**

```
브라우저 ──POST /.netlify/functions/pixellab-start──▶ 함수 ──(키 붙여서)──▶ Pixellab  → background_job_id
브라우저 ──GET  /.netlify/functions/pixellab-status?id=…──▶ 함수 ──▶ Pixellab  → processing / completed(프레임) / failed
```

- 시작과 상태 조회를 나눈다. Pixellab 애니메이션은 30초~5분 걸리는데, 함수 한 번이 그만큼 기다리면 Netlify 함수 실행 시간 제한에 걸린다.
- 브라우저는 상태 조회를 3초마다 부른다. 5분이 지나도 끝나지 않으면 실패로 처리한다.
- 함수에서 입력을 다시 검사한다: 이미지 크기(최대 256×256), 프레임 수(4·8·16), 동작 설명 길이. 브라우저 검사만 믿지 않는다.
- 사용할 API: `animate-with-text-v3` (첫 프레임 + 동작 설명, 4·8·16프레임).

**결과 형식**

- Pixellab은 프레임마다 따로 된 PNG(base64) 배열을 준다. 스프라이트 시트는 우리가 만든다.
- **기본: 스프라이트 시트 PNG 한 장.** 모든 칸이 같은 크기이고 칸 사이 여백은 0이다. 기존 `buildSheet`를 그대로 쓴다. Unity에서는 Sprite Editor의 `Grid By Cell Size`로 한 번에 잘린다.
- **선택: 낱장 PNG 묶음(zip).** 파일 이름은 `frame-01.png`, `frame-02.png` … 순서대로 짓는다. 런타임 의존성 0개 원칙을 지키기 위해, 압축하지 않는(STORE) 방식의 zip 작성 함수를 `io/zip.ts`에 직접 만든다. PNG는 이미 압축되어 있어 크기 손해가 거의 없다.

**기다리는 화면과 버튼 상태**

- "애니메이션 만들기" 버튼을 누르면 **결과가 나오거나 실패할 때까지 버튼을 비활성화**한다. 두 번 눌러서 요금이 두 번 나가는 일을 막는다.
- 기다리는 동안 진행 표시(경과 시간과 "보통 1~3분 걸려요" 안내)를 보여 준다.
- 실패하거나 시간이 초과되면 버튼을 다시 활성화하고, 무엇이 안 됐는지 문구로 알려 준다.
- 기다리는 중에 화면을 떠나면 상태 조회를 멈춘다.

**보안 설정(CSP) 변경**

- `netlify.toml`의 `connect-src 'none'`을 `connect-src 'self'`로 바꾼다. 브라우저는 우리 사이트의 함수 주소로만 요청하므로 Pixellab 주소를 허용 목록에 넣지 않는다.
- 이때부터 "사진은 이 컴퓨터 밖으로 전송되지 않아요" 문구가 AI 기능에서는 맞지 않으므로, 처음 쓸 때 외부 전송 동의 창을 띄운다.

## 13. 열린 질문

| 질문 | 왜 중요한가 | 정하는 시점 |
|------|-----------|----------|
| 혼자 개발하는가? **[가정]** | 여럿이면 Day별 계획을 모듈 담당으로 다시 나눔 | 시작 전 |
| 직접 그리기 결과를 바로 픽셀 아트로 쓸 수도 있게 할까? | 지금은 반드시 "변환하기"를 거침 | Day 1 |
| hueShift 강도(±15°)가 적절한가 | 결과 인상이 크게 달라짐 | Day 2 눈으로 확인 |
| 시트 열 수를 사용자가 바꾸게 할까 | 엔진마다 선호 배치가 다름 | Day 4 여유 시 |
