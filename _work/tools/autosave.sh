#!/bin/bash
# Каждые 10 минут сохраняет работу в ветку claude/modest-dirac-4jbvl4 (на случай обрыва сессии).
cd /home/user/svoya-igra || exit 1
while true; do
  sleep 600
  if [ -n "$(git status --porcelain)" ]; then
    git add -A >/dev/null 2>&1 && git commit -q -m "Автосохранение: пак в работе

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01McpjNvvRAJNFLDFxKXxbVq" >/dev/null 2>&1
  fi
  git push -q origin claude/modest-dirac-4jbvl4 >/dev/null 2>&1
done
