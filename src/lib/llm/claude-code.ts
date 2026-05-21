import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import type { ChatMessage, ChatProvider, StreamOptions } from "./types";

// Headless Claude Code provider — wraps the `claude -p` CLI in non-interactive
// mode. Lets local dev burn a Claude Code subscription instead of API credits.
//
// DO NOT USE IN PRODUCTION. The Render container has no `claude` binary and
// no authenticated keychain, so this provider will fail there. Keep production
// on AnthropicProvider via LLM_PROVIDER=anthropic.
//
// Hardening choices (so nothing project-local leaks into the model context):
//   - cwd = tmpdir() so Claude Code's CLAUDE.md auto-discovery has nothing
//     to find.
//   - --system-prompt replaces the default system. Per Claude Code's --help,
//     setting --system-prompt automatically excludes the dynamic sections
//     (cwd / git / memory paths / env info), so your user-memory and project
//     CLAUDE.md never make it to the model.
//   - --tools "" disables every built-in tool — the model can only chat,
//     not read files, run bash, or fetch the web.
//   - --no-session-persistence so each invocation is ephemeral.

type StreamEvent = {
  type?: string;
  event?: {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  error?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
};

export class ClaudeCodeProvider implements ChatProvider {
  readonly name = "claude-code";

  constructor(readonly model: string) {}

  async *streamChat(
    messages: ChatMessage[],
    opts: StreamOptions = {},
  ): AsyncIterable<string> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const turns = messages.filter((m) => m.role !== "system");

    // claude -p takes ONE prompt. For multi-turn context we flatten the
    // history into a labeled transcript and pipe it via stdin. The model is
    // smart enough to read "User: ... / Assistant: ... / User: ..." as a
    // conversation; we're not relying on tool-call structured turn semantics.
    const prompt = turns
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const args = [
      "-p",
      "--verbose", // required by stream-json
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--model",
      this.model,
      "--no-session-persistence",
      "--tools",
      "",
    ];
    if (system) {
      args.push("--system-prompt", system);
    }

    const child = spawn("claude", args, {
      cwd: tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
      signal: opts.signal,
    });

    let stderr = "";
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    // Write the user prompt via stdin, then close it so claude knows we're done.
    child.stdin.write(prompt);
    child.stdin.end();

    let lineBuf = "";
    try {
      for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
        lineBuf += chunk.toString("utf-8");

        let nl: number;
        while ((nl = lineBuf.indexOf("\n")) >= 0) {
          const line = lineBuf.slice(0, nl);
          lineBuf = lineBuf.slice(nl + 1);
          if (!line.trim()) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }

          // Token deltas land as stream_event → content_block_delta → text_delta.
          if (
            event.type === "stream_event" &&
            event.event?.type === "content_block_delta" &&
            event.event.delta?.type === "text_delta" &&
            typeof event.event.delta.text === "string"
          ) {
            yield event.event.delta.text;
            continue;
          }

          // The final result event reports auth / model errors that didn't
          // surface as exceptions earlier (e.g. "Not logged in").
          if (event.type === "result" && event.is_error && event.result) {
            throw new Error(`claude-code: ${event.result}`);
          }
        }
      }
    } finally {
      // Make sure we don't leave the process orphaned if the consumer
      // abandons the async iterator partway through.
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
      }
    }

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.on("close", resolve);
      child.on("error", reject);
    });
    if (exitCode !== 0 && exitCode !== null) {
      throw new Error(
        `claude-code exited ${exitCode}: ${stderr.slice(0, 300).trim() || "(no stderr)"}`,
      );
    }
  }
}
