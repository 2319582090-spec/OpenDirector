import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const styles = {
  shell: {
    backgroundColor: "#f6f1e8",
    color: "#0f1720",
    fontFamily: '"PingFang SC", "Helvetica Neue", sans-serif',
  },
  gradient: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 12% 18%, rgba(214, 94, 48, 0.18), transparent 24%), radial-gradient(circle at 86% 12%, rgba(24, 129, 103, 0.16), transparent 28%), linear-gradient(135deg, #f8f4eb 0%, #f2ece0 48%, #f7f1e6 100%)",
  },
  card: {
    position: "absolute",
    inset: 48,
    borderRadius: 34,
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(15, 23, 32, 0.08)",
    boxShadow: "0 24px 80px rgba(37, 46, 53, 0.12)",
    padding: 54,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  eyebrow: {
    display: "inline-flex",
    padding: "10px 16px",
    borderRadius: 999,
    background: "rgba(214, 94, 48, 0.09)",
    color: "#bb4f25",
    fontSize: 22,
    fontWeight: 700,
  },
  title: {
    margin: "24px 0 16px",
    fontSize: 78,
    lineHeight: 0.96,
    letterSpacing: "-0.08em",
    fontWeight: 800,
  },
  subtitle: {
    maxWidth: 920,
    margin: 0,
    fontSize: 30,
    lineHeight: 1.5,
    color: "#51606b",
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginTop: 30,
  },
  block: {
    padding: 22,
    borderRadius: 24,
    background: "rgba(244, 240, 234, 0.9)",
    border: "1px solid rgba(15, 23, 32, 0.06)",
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#8b5b2f",
    marginBottom: 12,
  },
  blockBody: {
    fontSize: 24,
    lineHeight: 1.55,
    color: "#24313b",
    whiteSpace: "pre-wrap",
  },
};

export const DirectorBoard = ({ variant, title, subtitle, detail, badge, meta = [] }) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 25], [24, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...styles.shell, opacity }}>
      <AbsoluteFill style={styles.gradient} />
      <div style={{ ...styles.card, transform: `translateY(${rise}px)` }}>
        <div>
          <div style={styles.eyebrow}>{badge || "网页版导演工作台"}</div>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>

        <div style={styles.footer}>
          <div style={styles.block}>
            <div style={styles.blockTitle}>{variant === "scene" ? "镜头说明" : "导出说明"}</div>
            <div style={styles.blockBody}>{detail}</div>
          </div>
          <div style={styles.block}>
            <div style={styles.blockTitle}>当前卡片</div>
            <div style={styles.blockBody}>{meta.join("\n")}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
