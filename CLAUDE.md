# Documentation Policy

Do not create or expand Markdown docs unless explicitly asked — unprompted, you tend to clutter the repo with over-citation, paternalistic "helpfulness," and runbooks nobody wanted.

# Web Fetch Strategy

When fetching web content, try methods in this order — but if the URL is in a public GitHub repo, `git clone` it instead of fetching files one by one. Move to the next if the current one fails (e.g. 403, timeout, aborted):

1. **WebFetch tool** — Default. Try this first.
2. **curl fallback** — If WebFetch returns 403, retry with `curl -sL -A "claude-code/1.0" <url>`. Many 403s are caused by Cloudflare blocking the default `Claude-User` User-Agent.
3. **readability fallback** — `npx -y @mizchi/readability --format=md "<url>"` extracts the main content (strips nav/ads/sidebars) and serializes to Markdown.

# Code Comments Policy

- Default to zero comments. Code should explain itself through naming and structure
- Do NOT add comments explaining what changed or why (`// changed from X to Y`, `// updated for feature Z` are forbidden)
- Add a comment only as a last resort, when non-obvious logic cannot be clarified by refactoring or renaming first

# サブエージェント

サブエージェントの使用時は必ずOpusかsonnetを明示してください。明示しない場合haikuにフォールバックするバグが貴方のハーネス(claude code)にはあります。精度の低いhaikuを使用しないでください。

## コードベース探索の委譲

コードベースへの質問が大量の grep・探索・解析になりそうで、欲しいのが結論だけなら、自分で読み回さずサブエージェントに投げて結論を受け取る。検索軸が複数あるなら並列で。自分で編集・検証するためにコードを手元に置きたいときは直接読む。

## Subagent Delegation

Subagents run the latest model — treat them as a trusted colleague, not a process to micromanage.

- Reserve hard assertions ("must", "always") for true invariants only — output contracts, safety constraints. Everything else: hand over the goal and decision rules, and let the subagent choose how.
- Don't bake unverified premises into the prompt. Asking one to read a file? Don't guess its contents from the title and prompt as if the guess were fact — state what you know, leave the unknown unknown.
- Leave an escape hatch — let it report "the premise was wrong", "not found", or "not sure" instead of forcing a committed answer.

A capable model boxed in with no escape hatch doesn't hallucinate so much as assert conjecture — stating a guess as fact. Rigid constraints raising accuracy is a previous-generation assumption.

# コード設計

- 関心の分離を保つ
- 状態とロジックを分離する
- コントラクト層（API/型）を厳密に定義し、実装層は再生成可能に保つ

