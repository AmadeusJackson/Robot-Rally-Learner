"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
function createStore(directory, defaults = {}, validate = (value) => value) {
  const file = path.join(directory, "state.json");
  let pending = Promise.resolve();
  const empty = () => ({
    version: 1,
    decks: [],
    levels: [],
    results: [],
    settings: { ...defaults },
    session: null,
  });
  return {
    async load() {
      await pending.catch(() => {});
      try {
        const stat = await fs.stat(file);
        if (stat.size > 60 * 1024 * 1024)
          throw Error("Saved state exceeds 60 MB.");
        const data = JSON.parse(await fs.readFile(file, "utf8"));
        if (
          !data ||
          data.version !== 1 ||
          !Array.isArray(data.decks) ||
          !Array.isArray(data.levels) ||
          !Array.isArray(data.results) ||
          typeof data.settings !== "object"
        )
          throw Error("Invalid saved state");
        return validate({
          ...empty(),
          ...data,
          settings: { ...defaults, ...data.settings },
        });
      } catch (e) {
        if (e.code === "ENOENT") return empty();
        throw Error(
          "Saved progress could not be read. Your existing file has been preserved: " +
            e.message,
        );
      }
    },
    save(state) {
      const data = JSON.stringify(validate(state));
      if (Buffer.byteLength(data) > 60 * 1024 * 1024)
        return Promise.reject(
          Error(
            "Local library exceeds the 60 MB limit. Remove unused presentations.",
          ),
        );
      const operation = pending
        .catch(() => {})
        .then(async () => {
          await fs.mkdir(directory, { recursive: true });
          const temp = file + ".tmp";
          await fs.writeFile(temp, data, { mode: 0o600 });
          await fs.rename(temp, file);
          return { saved: true };
        });
      pending = operation;
      return operation;
    },
    file,
  };
}
module.exports = { createStore };
