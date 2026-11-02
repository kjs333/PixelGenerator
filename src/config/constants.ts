export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SOURCE_SIZE = 4096;
export const MAX_ART_SIZE = 256;
export const FREEHAND_SIZE = 512;
export const MAX_LAYERS = 10;
export const MAX_FRAMES = 32;
export const MAX_UNDO = 50;
export const MAX_UNDO_BYTES = 128 * 1024 * 1024; // 되돌리기 기록 전체 메모리 상한
export const CLEANUP_MAX_LUMA_DIFF = 48; // 외톨이 정리: 이 밝기 차이(0~255) 이하일 때만 주변 색으로 바꾼다
export const MAX_PIXEL_BRUSH = 16; // 결과 수정: 붓 크기 최대 N×N 칸
export const MAX_PIXEL_ZOOM = 64; // 결과 수정: 화면 확대 배율 최대(정수 배율만)
export const MAX_FREEHAND_ZOOM = 8; // 그리기·사진 수정: Ctrl+휠 화면 확대 배율 최대
export const MIN_FREEHAND_ZOOM = 0.1; // 그리기·사진 수정: Ctrl+휠 화면 축소 배율 최소
export const MAX_SAVED_COLORS = 12; // 색 선택 창에 저장해 두는 색의 최대 개수
export const MIN_COLORS = 4;
export const MAX_COLORS = 32;
export const ART_SIZE_PRESETS = [8, 16, 32, 64] as const;
export const EXPORT_SCALES = [1, 2, 4, 8] as const; // PNG 저장 배율. 1이 원래 해상도(기본)

// AI 애니메이션(Pixellab animate-with-text-v3). 브라우저와 Netlify 함수가 같은 값으로 검사한다.
export const ANIMATION_FRAME_COUNTS = [4, 8, 16] as const;
export const DEFAULT_ANIMATION_FRAMES = 8 as const;
export const ANIMATION_MAX_SIZE = 256; // 첫 프레임 가로·세로 최대
export const PIXEL_ART_MAX_COLORS = 64; // 애니메이션용 픽셀 그림으로 받는 색 수 최대(투명은 한 색)
export const ANIMATION_MAX_PIXELS = 524_288; // 가로 × 세로 × 프레임 수 상한(Pixellab 제한)
export const MAX_ACTION_LENGTH = 500; // 동작 설명 글자 수 최대(Pixellab은 1000자까지 받는다)
export const ANIMATION_POLL_MS = 3000; // 상태 조회 간격
export const ANIMATION_TIMEOUT_MS = 5 * 60 * 1000; // 이 시간이 지나도 끝나지 않으면 실패로 본다
export const ANIMATION_POLL_RETRIES = 3; // 상태 조회가 연달아 이만큼 실패하면 멈춘다

// 스프라이트 시트·미리보기
export const DEFAULT_FPS = 8;
export const MIN_FPS = 1;
export const MAX_FPS = 24;
