# Contributing to OpenDirector

Thank you for helping build OpenDirector.

OpenDirector is an open-source AI director Agent ecosystem. We welcome developers, directors, writers, editors, designers, sound creators, music creators, AI model builders, local model maintainers, tool makers, and anyone who cares about open creative tools.

## How You Can Help

- Improve the web workbench experience.
- Add or improve model/provider integrations.
- Build better director workflows for script, shots, assets, voiceover, music, editing, and final preview.
- Share real production pain points and examples.
- Improve documentation, tests, and setup reliability.

## Ecosystem Contribution Types

OpenDirector is built around the slogan: **一个想法，自由选择，导演 Agent。**

Good contribution areas include:

- Model integrations for script, image, video, music, voice, editing, and multimodal reasoning.
- Local model adapters so creators can run parts of the workflow on their own machines.
- Memory systems inspired by Hermes: user preferences, creative style, successful cases, reusable skills, and decision history.
- Global orchestration inspired by Manus: task decomposition, model routing, resource planning, and full-process automation.
- Platform and plugin systems inspired by OpenClaw: Agent runtime, tool management, model management, and multimodal interfaces.
- Custom development workflows inspired by Claude Code: advanced editing logic, intelligent music scoring, multilingual voice adaptation, and production-specific plugins.
- Editing algorithms, music algorithms, voice adaptation, storyboard templates, and director formulas that can become reusable modules.

## Creative Workflow Contributions

If you are a creator rather than a developer, your contribution still matters. Please open an issue with:

- The kind of film, short, animation, ad, music video, or creative project you are making.
- Where current AI tools break down.
- What a director would need to inspect, control, or approve.
- Any director formulas, storyboard structures, editing logic, or production habits that could become part of the software.

Shaoqi Shao is a director and can help translate real creative workflow into buildable product and engineering tasks for the community.

## Model and Tool Ecosystem

We welcome integrations with cloud models, local models, open-source models, and creative tools. Example areas:

| Workflow area | Example models and tools |
| --- | --- |
| 剧本创作 | ChatGPT, Gemini, DeepSeek, 豆包 |
| 文生视频 | Sora 2, Seedance 2.0, 即梦 |
| 配乐 | Suno, Lyria 3, MiniMax Music |
| 配音 | ElevenLabs, Resemble AI, Uberduck |
| 剪辑 | Medeo, ChatCut, LTX Desktop |
| 导演 Agent | GPT-5.5, Claude 3, Gemini, Manus |

These are ecosystem directions and possible integrations. A contribution does not need to support every model. A focused adapter, workflow, or plugin is enough.

## Development

```bash
npm install
npm test
npm run dev
```

The app runs at:

```text
http://127.0.0.1:8123/
```

## Pull Requests

Before opening a pull request:

- Keep changes focused.
- Do not commit `.env.local`, API keys, generated videos, generated images, or local job JSON files.
- Run `npm test`.
- Include screenshots or a short screen recording for UI changes when possible.
- Explain how your change helps the director workflow.

## Contact

- `239582090@qq.com`
- `2319582090z@google.com`
- `scq2319582090@outlook.com`

For public collaboration, GitHub Issues are preferred so others can learn from and join the discussion.
