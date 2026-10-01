/** Brand die for generated images (apple-icon, opengraph-image). Mirrors app/icon.svg. */
export function BrandMark({ size }: { size: number }) {
  const die = size * 0.6;
  const pip = die * 0.2;
  const dot = (x: number, y: number, color = "#2a2118") => (
    <div
      style={{
        position: "absolute",
        left: x * die - pip / 2,
        top: y * die - pip / 2,
        width: pip,
        height: pip,
        borderRadius: pip,
        background: color,
      }}
    />
  );
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size * 0.24,
        background: "linear-gradient(135deg, #e4b558, #b8862f)",
        boxShadow: `0 ${size * 0.04}px 0 #8a6420`,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: die,
          height: die,
          borderRadius: die * 0.25,
          background: "linear-gradient(180deg, #fffdf6, #f1e6cc)",
          boxShadow: `0 ${die * 0.08}px 0 rgba(74,44,26,0.35)`,
          transform: "rotate(-10deg)",
        }}
      >
        {dot(0.26, 0.26)}
        {dot(0.74, 0.26)}
        {dot(0.5, 0.5, "#c0392b")}
        {dot(0.26, 0.74)}
        {dot(0.74, 0.74)}
      </div>
    </div>
  );
}
