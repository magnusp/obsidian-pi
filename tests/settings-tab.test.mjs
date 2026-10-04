import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class PluginSettingTab {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = { empty: vi.fn() };
    }
  }

  class Setting {
    setName() {
      return this;
    }

    setHeading() {
      return this;
    }
  }

  return {
    FuzzySuggestModal: class {},
    Modal: class {},
    Notice: class {},
    PluginSettingTab,
    Setting,
    SuggestModal: class {}
  };
});

const { PiAgentSettingTab } = await import("../src/plugin/settings-tab.mjs");

function createTab(settings = {}) {
  return new PiAgentSettingTab(
    { vault: { configDir: ".config" } },
    {
      settings: { ignoredFolders: [".git"], showExtensionStatus: true, ...settings },
      setShowExtensionStatus: vi.fn()
    }
  );
}

function flattenDefinitions(definitions) {
  return definitions.flatMap((definition) =>
    definition.type === "group" ? (definition.items ?? []) : [definition]
  );
}

describe("Pi agent settings tab API compatibility", () => {
  it("uses the vault's configured settings folder instead of a hardcoded path", () => {
    const tab = createTab();

    expect(tab.plugin.settings.ignoredFolders).toEqual([".config", ".git"]);
  });

  it("exposes every setting through searchable 1.13 definitions", () => {
    const definitions = createTab().getSettingDefinitions();
    const items = flattenDefinitions(definitions);

    expect(items.map((item) => item.name)).toEqual([
      "Model",
      "Thinking level",
      "Tool mode",
      "Desktop completion notifications",
      "Show extension status",
      "Custom instructions",
      "Custom model slug",
      "Pi executable path",
      "Check Pi installation",
      "Run Pi inside a nono sandbox",
      "Nono profile",
      "nono executable path",
      "Check nono setup",
      "Include default Pi skills",
      "Additional skill folders",
      "Ignored folders/directories"
    ]);
    expect(items.every((item) => typeof item.render === "function")).toBe(true);
  });

  it("delegates extension status toggle changes to the plugin", async () => {
    const tab = createTab();
    let onChange;
    const toggle = {
      setValue: vi.fn(() => toggle),
      onChange: vi.fn((callback) => {
        onChange = callback;
        return toggle;
      })
    };

    tab.getExtensionStatusDefinition().render({ addToggle: (callback) => callback(toggle) });
    await onChange(false);

    expect(toggle.setValue).toHaveBeenCalledWith(true);
    expect(tab.plugin.setShowExtensionStatus).toHaveBeenCalledWith(false);
  });

  it("hides the nono profile field when nono is not detected", () => {
    const tab = createTab({ nonoExecutablePath: "" });
    tab.getNonoExecutablePath = vi.fn(() => null);

    expect(tab.getNonoProfileDefinition().desc).toContain("Required");
    expect(
      tab.getNonoSandboxDefinition().desc
    ).toContain("nono was not found on PATH");
    expect(() => tab.getNonoProfileDefinition().render({})).not.toThrow();
  });

  it("keeps legacy display rendering while routing 1.13 refreshes through update", () => {
    const tab = createTab();
    tab.renderLegacyDefinition = vi.fn();

    tab.display();
    expect(tab.containerEl.empty).toHaveBeenCalledOnce();
    expect(tab.renderLegacyDefinition).toHaveBeenCalledTimes(16);

    tab.containerEl.empty.mockClear();
    tab.update = vi.fn();
    tab.display();
    expect(tab.update).toHaveBeenCalledOnce();
    expect(tab.containerEl.empty).not.toHaveBeenCalled();
  });
});
