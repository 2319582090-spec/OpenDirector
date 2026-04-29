import React from "react";
import { Composition, registerRoot } from "remotion";
import { DirectorBoard } from "./DirectorBoard.jsx";

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="DirectorBoard"
        component={DirectorBoard}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          variant: "intro",
          title: "OpenDirector",
          subtitle: "把灵感直接压成可以继续生产的样片。",
          detail: "默认 Remotion 模板卡片",
          badge: "网页 MVP",
          meta: ["Web", "Remotion", "FFmpeg"],
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
