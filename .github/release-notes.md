## Fixes

ZCode showed **Chat Completions** providers as **OpenAI Responses**.

ZCode `kind` values are not the HyperSwitch names:

- `openai-compatible` → Chat Completions
- `openai` → Responses
- `anthropic` → Anthropic Messages

HyperSwitch previously wrote both Chat and Responses as `kind: openai`. Anthropic Messages was already correct.

If a Chat provider was saved before 0.1.1, open it in HyperSwitch, pick Chat Completions again, and save.

## 修复

ZCode 里选 Chat Completions，打开却是 Responses。

原因：ZCode 的 `kind: openai` 表示 Responses，Chat 必须写成 `openai-compatible`。以前两种都写成了 `openai`。Anthropic Messages 本来就是对的。

0.1.1 之前按 Chat 保存过的供应商，请在 HyperSwitch 里重新选协议再保存一次。
