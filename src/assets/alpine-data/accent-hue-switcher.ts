import { applyHue, currentHue } from "../utils/accent-hue";

interface AccentHuePreset {
  hue: number;
  key: string;
}

/** 预设色相：蓝色与 Tailwind blue 对齐（默认值），其余沿色环均匀分布 */
const PRESETS: AccentHuePreset[] = [
  { hue: 250, key: "blue" },
  { hue: 195, key: "cyan" },
  { hue: 150, key: "green" },
  { hue: 60, key: "amber" },
  { hue: 300, key: "purple" },
];

export default () => ({
  open: false,
  activeHue: currentHue(),
  get presets() {
    return PRESETS.map((preset) => ({
      hue: preset.hue,
      label: window.i18nResources[`jsModule.accentHue.${preset.key}`] ?? String(preset.hue),
      // 任意色相无法预生成 Tailwind 工具类，色块直接用行内样式
      swatch: `background-color: oklch(58% 0.16 ${preset.hue})`,
    }));
  },
  selectHue(hue: number) {
    this.activeHue = applyHue(hue, true);
    this.open = false;
  },
});
