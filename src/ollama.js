"use strict";
function endpoint(value) {
  const u = new URL(value || "http://127.0.0.1:11434");
  if (
    u.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !["", "/"].includes(u.pathname)
  )
    throw Error(
      "Use a local HTTP Ollama address, such as http://127.0.0.1:11434.",
    );
  return u.origin;
}
async function localFetch(base, route, options = {}) {
  const response = await fetch(endpoint(base) + route, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(route === "/api/tags" ? 4000 : 180000),
  });
  if (!response.ok) throw Error("Ollama returned HTTP " + response.status);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2 * 1024 * 1024) throw Error("Model response is too large.");
  const reader = response.body.getReader();
  let total = 0,
    chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 2 * 1024 * 1024) {
      await reader.cancel();
      throw Error("Model response is too large.");
    }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
module.exports = { endpoint, localFetch };
