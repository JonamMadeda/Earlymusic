export const hashStr = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export const avoidGreen = (h) => {
  if (h < 55 || h >= 175) return h;
  return 175 + Math.floor((h - 55) * 185 / 120);
};

export const pastelGradient = (seed) => {
  const h = avoidGreen(hashStr(seed || "default") % 360);
  const s = 55 + (hashStr((seed || "default") + "s") % 20);
  const l = 55 + (hashStr((seed || "default") + "l") % 15);
  const h2 = avoidGreen((h + 30 + (hashStr((seed || "default") + "h") % 20)) % 360);
  return `linear-gradient(135deg, hsl(${h}, ${s}%, ${l}%), hsl(${h2}, ${s - 5}%, ${l + 8}%))`;
};

export const initialLetter = (title) => {
  const match = title?.match(/[a-zA-Z]/);
  return match ? match[0].toUpperCase() : "?";
};

export const gradientFirstColor = (seed) => {
  const h = avoidGreen(hashStr(seed || "default") % 360);
  const s = 55 + (hashStr((seed || "default") + "s") % 20);
  const l = 55 + (hashStr((seed || "default") + "l") % 15);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const sizeMap = {
  xs: "h-6 w-6 text-[9px] rounded-md",
  sm: "h-7 w-7 text-[11px] rounded-xl",
  "avatar-mini": "h-8 w-8 text-[10px] rounded-xl",
  md: "h-10 w-10 text-sm md:h-12 md:w-12 md:text-base rounded-xl",
  lg: "h-12 w-12 text-sm md:h-14 md:w-14 md:text-base rounded-xl",
};

const SongAvatar = ({ title, size = "md" }) => {
  const classes = sizeMap[size] || sizeMap.md;
  const letter = initialLetter(title);
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-bold text-white shadow-sm ${classes}`}
      style={{ background: pastelGradient(title || "default") }}
    >
      {letter}
    </div>
  );
};

export default SongAvatar;
