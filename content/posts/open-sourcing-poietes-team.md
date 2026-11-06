# Open-Sourcing Poietes-Team: What Hardening a Multi-Agent CLI Taught Me

*November 5, 2026 | By Cassidy Dobratz*

Back in March I wrote about [building a team of AI agents](/blog/building-team-of-ai-agents). Poietes-Team is now open source under the Apache-2.0 license: **[github.com/cdobratz/Poietes-Team](https://github.com/cdobratz/Poietes-Team)**.

It is a small Python CLI. A supervisor takes a task in plain language and routes it to specialist agents that monitor, audit, and propose code changes across your projects, then reports back on the command line or in Telegram. It is also the free, hands-on piece of what we build at [Poietes](https://poietes.org), alongside TraceLamp and [ParseHub](https://parsehub.dev). If you want to see how we think about agents and code, this is the place to start.

## What's in the box

| Agent | What it does |
|---|---|
| Monitor | File and line counts, TODO/FIXME markers, git status, outdated dependencies |
| Coder | Plans file edits from a task, and applies them only when you allow writes |
| Security | Runs Bandit, Semgrep, and a dependency audit, then summarizes the results |
| Content | Drafts READMEs, changelog entries, and docstrings |
| Filesystem | Scans, searches, and maps any directory with no config required |

LLM calls go through LiteLLM, so Anthropic, xAI, Ollama, and MiniMax all work. Memory uses Mem0 if you configure it. Otherwise it stays in-process and disappears when the run ends.

```bash
pip install -r requirements.txt
cp config/settings.example.yaml config/settings.yaml
cp config/projects.example.yaml config/projects.yaml
export ANTHROPIC_API_KEY=...
python main.py validate
python main.py run --task "scan all projects" --dry-run
```

## Before going public: a hardening pass

Running a private project is very different from handing other people a tool that asks an LLM to edit their files. Before release I reviewed the code for gaps and shipped a hardening pass. These are the lessons I'd pass on to anyone building agent tooling.

**1. Default to read-only.** `workspace.approval_required` is `true` out of the box. The coder and content agents plan their edits but write nothing until you switch writes on for a project you trust. An agent's first run should never be the one that surprises you.

**2. Never trust a path the model gives you.** Every file path an agent supplies now goes through a single `safe_join` helper, which rejects `../` tricks and absolute paths. One choke point is far easier to test than a dozen scattered `os.path.join` calls.

**3. Keep tokens out of URLs.** Git tokens used to be embedded in clone URLs, which means they can leak into logs, error messages, and process listings. Now they are sent as an HTTP header and scrubbed from any output.

**4. Allowlist your chat bot.** The Telegram listener only accepts commands from configured chat IDs, and a concurrency cap stops a flood of `/run` requests from spawning unlimited agent runs.

**5. Make config fail loudly.** An unset `${VAR}` is now an error instead of silently becoming an empty string. `${VAR:-default}` gives you an explicit fallback, and unknown keys are rejected so typos don't pass quietly.

**6. Run containers as non-root, with no Docker socket.** Config is mounted read-only, and the runner is one-shot instead of restarting forever.

**7. Be honest about stubs.** The GitHub, GitLab, and deploy skills are placeholders. They now say so explicitly by returning `not_implemented` instead of pretending to succeed, and the README says so too.

The README got the same treatment. It is now short, and every command and claim in it matches what the code actually does. The pass also added a set of new tests, and CI runs pytest on every push.

## Trying Entire as a mirror

I also tried hosting the repo on [Entire](https://entire.com) as a **GitHub mirror**, so GitHub stays the source of truth. A few observations from that test:

- Setup was GitHub SSO, then installing the Entire GitHub App on **only** the Poietes-Team repo instead of all of them.
- The install asked for read/write on Code, Pull requests, Workflows, and Checks. Read the permission list before you click.
- I saw no billing screen on the mirror path, and the first sync finished in about a minute.
- The "View all files 0" label is misleading. Clicking it shows the full tree.
- Entire's commit count (14) didn't match GitHub's (23) when I looked, so I wouldn't call it full history parity yet.
- The settings popover suggests `entire repo remote add origin --override`, which **replaces your GitHub `origin`**. If you want GitHub to stay primary, use a fresh `entire repo clone` instead.

I haven't set up the CLI, session capture, or Entire's agent features yet. That's a future post.

## Try it

Clone **[Poietes-Team](https://github.com/cdobratz/Poietes-Team)**, run it with `--dry-run` against a project you know well, and open an issue if something breaks or surprises you. Contributions are welcome, and the license is Apache-2.0, so you can build on it.
