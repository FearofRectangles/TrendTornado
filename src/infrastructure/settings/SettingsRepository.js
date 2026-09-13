import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SETTINGS, validateSettings } from "../../config/DefaultSettings.js";

const settingsPath = path.resolve("data", "config", "settings.json");

export class SettingsRepository {
  static async load() {
    try {
      const stored = JSON.parse(await readFile(settingsPath, "utf8"));
      return validateSettings({
        analysis: { ...DEFAULT_SETTINGS.analysis, ...stored.analysis },
        ergonomics: { ...DEFAULT_SETTINGS.ergonomics, ...stored.ergonomics },
        distance: { ...DEFAULT_SETTINGS.distance, ...stored.distance },
        classification: { ...DEFAULT_SETTINGS.classification, ...stored.classification },
      });
    } catch (error) {
      if (error.code === "ENOENT") return validateSettings(DEFAULT_SETTINGS);
      throw error;
    }
  }

  static async save(settings) {
    const validated = validateSettings(settings);
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    return validated;
  }

  static get path() {
    return settingsPath;
  }
}
