import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Prospect Scout — search organizations across sectors and public evidence sources";
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
          background: "linear-gradient(160deg, #050608 0%, #0a1218 45%, #101419 100%)",
          padding: "48px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <img
            src={logoSrc}
            alt=""
            width={112}
            height={112}
            style={{
              borderRadius: 9999,
              border: "2px solid rgba(56, 224, 216, 0.35)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 52,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#eef1f6",
                lineHeight: 1.05,
              }}
            >
              Prospect Scout
            </div>
            <div
              style={{
                fontSize: 28,
                color: "#8a939f",
                lineHeight: 1.25,
                maxWidth: 720,
              }}
            >
              Search organizations. Find the signal.
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 22,
            color: "#565f6d",
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.45,
          }}
        >
          Discover companies, agencies, and institutions by sector, location, and
          evidence from CMS, SEC, FDA, RSS, and public web sources.
        </div>
      </div>
    ),
    { ...size },
  );
}
