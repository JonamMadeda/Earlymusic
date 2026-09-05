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
  const match = String(title || "").match(/[\p{L}]/u);
  return match ? match[0].toUpperCase() : "?";
};

export const gradientFirstColor = (seed) => {
  const h = avoidGreen(hashStr(seed || "default") % 360);
  const s = 55 + (hashStr((seed || "default") + "s") % 20);
  const l = 55 + (hashStr((seed || "default") + "l") % 15);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

export const brandGradient = (seed) => {
  const navyHues = [215, 222, 230, 240, 260, 280];
  const h = navyHues[hashStr(seed || "default") % navyHues.length];
  return `linear-gradient(135deg, hsl(${h}, 50%, 18%), hsl(${h + 20}, 45%, 28%))`;
};

const sizeMap = {
  xs: "h-6 w-6 text-[10px] rounded-md",
  sm: "h-7 w-7 text-xs rounded-xl",
  "avatar-mini": "h-8 w-8 text-xs rounded-xl",
  md: "h-10 w-10 text-sm md:h-12 md:w-12 md:text-base rounded-xl",
  lg: "h-12 w-12 text-sm md:h-14 md:w-14 md:text-base rounded-xl",
};

export const VinylArtwork = ({ title, isPlaying = false }) => {
  const letter = initialLetter(title);
  return (
    <div className="relative flex items-center justify-center py-4">
      {/* Vinyl record with spinning animation when playing */}
      <div
        className={`relative aspect-square w-52 sm:w-64 md:w-72 lg:w-80 rounded-full bg-neutral-900 border-4 border-neutral-800/90 flex items-center justify-center transition-all duration-700 ${
          isPlaying ? "animate-[spin_16s_linear_infinite]" : ""
        }`}
        style={{
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.7), inset 0 0 25px rgba(255,255,255,0.06)",
          backgroundImage:
            "repeating-radial-gradient(circle, transparent, transparent 3px, rgba(255,255,255,0.035) 4px, transparent 5px)",
        }}
      >
        {/* Subtle groove rings */}
        <div className="absolute inset-4 sm:inset-6 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute inset-8 sm:inset-12 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute inset-14 sm:inset-18 rounded-full border border-white/5 pointer-events-none" />

        {/* Center label */}
        <div className="relative aspect-square w-22 sm:w-28 rounded-full bg-gradient-to-br from-slate-900 via-accent to-slate-800 p-1 shadow-inner flex flex-col items-center justify-center border-2 border-white/20">
          <div className="absolute inset-1 rounded-full border border-white/10" />
          <span className="text-2xl sm:text-3xl font-black text-white select-none drop-shadow-md">
            {letter}
          </span>
          <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.2em] text-white/70 uppercase mt-0.5 select-none">
            Luumbo
          </span>
          {/* Center spindle hole */}
          <div className="absolute h-3 w-3 rounded-full bg-neutral-900 border border-white/40 shadow-inner" />
        </div>
      </div>
    </div>
  );
};

const SongAvatar = ({ title, size = "md", variant = "brand" }) => {
  const classes = sizeMap[size] || sizeMap.md;
  const letter = initialLetter(title);
  if (variant === "mono") {
    return (
      <div
        className={`flex shrink-0 items-center justify-center font-bold text-accent shadow-sm ${classes} bg-accent/[0.08] border border-accent/10`}
      >
        {letter}
      </div>
    );
  }
  if (variant === "pastel") {
    return (
      <div
        className={`flex shrink-0 items-center justify-center font-bold text-white shadow-sm ${classes}`}
        style={{ background: pastelGradient(title || "default") }}
      >
        {letter}
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-bold text-white shadow-sm ${classes}`}
      style={{ background: brandGradient(title || "default") }}
    >
      {letter}
    </div>
  );
};

export default SongAvatar;
