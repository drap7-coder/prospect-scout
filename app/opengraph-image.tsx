import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Prospect Scout — find your next best opportunity with AI-powered organization discovery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logoPath = join(process.cwd(), "public/prospect-scout-logo.png");
  const logoBuffer = await readFile(logoPath);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 18%, rgba(45,212,191,0.18), transparent 42%), linear-gradient(180deg, #071422 0%, #020b16 55%, #01070f 100%)",
          padding: "48px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <img
            src={logoSrc}
            alt=""
            width={128}
            height={128}
            style={{
              borderRadius: 9999,
              border: "3px solid rgba(56, 224, 216, 0.35)",
              boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                fontSize: 54,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#ffffff",
                lineHeight: 1.05,
                textAlign: "center",
              }}
            >
              Find your next best opportunity.
            </div>
            <div
              style={{
                fontSize: 26,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.35,
                textAlign: "center",
                maxWidth: 820,
              }}
            >
              AI-powered prospecting across health plans, hospitals,
              manufacturers, and more.
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#5eead4",
            }}
          >
            Prospect Scout
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
