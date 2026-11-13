#!/usr/bin/env bash
# Injects "Architecture Tests" from AGENTS.md — the single source of truth in
# D7460N-ai/D7460N.ai. No rule text lives here. Reads the local clone
# (~/D7460N.ai, the same clone ~/.claude/CLAUDE.md imports); falls back to GitHub.
# Usage: autocss-law.sh <HookEventName>
event="$1"
src="$HOME/D7460N.ai/AGENTS.md"
if [ -r "$src" ]; then
  text=$(cat "$src")
else
  text=$(curl -fsSL --max-time 5 https://raw.githubusercontent.com/D7460N-ai/D7460N.ai/main/AGENTS.md) || exit 0
fi
section=$(printf '%s\n' "$text" | awk '/^## [0-9]+\. Architecture Tests/{f=1; print; next} f && /^#{1,2} /{exit} f')
[ -n "$section" ] || exit 0
esc=$(printf '%s\n' "$section" | awk 'BEGIN{ORS=""} {gsub(/\r/,""); gsub(/\\/,"\\\\"); gsub(/"/,"\\\""); gsub(/\t/,"\\t"); print $0 "\\n"}')
printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"Canonical AutoCSS law (D7460N-ai/D7460N.ai AGENTS.md):\\n%s"}}\n' "$event" "$esc"
