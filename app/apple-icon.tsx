import { ImageResponse } from "next/og";

import { BrandMark } from "./brandMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: the brand die on the felt green (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1b6147" }}>
        <BrandMark size={140} />
      </div>
    ),
    size
  );
}
