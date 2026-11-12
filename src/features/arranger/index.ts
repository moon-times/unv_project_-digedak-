// 반주 엔진 공개 API. 다른 폴더에서는 "@/features/arranger"로 가져다 씁니다.
export { generateAccompaniment, type ArrangeOptions } from "./generate";
export {
  DRUM,
  STYLE_PATTERNS,
  type GuitarHit,
  type StylePattern,
} from "./patterns";
export { bassPitch, chooseVoicing, guitarVoicing } from "./voicing";
