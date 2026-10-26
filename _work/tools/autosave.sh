#!/bin/bash
# Каждые 10 минут сохраняет работу в текущую ветку на GitHub (на случай обрыва сессии).
# Запуск в фоне: setsid nohup bash _work/tools/autosave.sh >/tmp/autosave.log 2>&1 < /dev/null &
cd /home/user/svoya-igra || exit 1
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SESSION=${CLAUDE_SESSION_URL:-https://claude.ai/code/session_01YPnpDm9zCmpMekVR1Xy87F}
while true; do
  sleep 600
  if [ -n "$(git status --porcelain)" ]; then
    git add -A >/dev/null 2>&1 && git commit -q -m "Автосохранение: пак в работе

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: $SESSION" >/dev/null 2>&1
  fi
  git push -q origin "$BRANCH" >/dev/null 2>&1
done
