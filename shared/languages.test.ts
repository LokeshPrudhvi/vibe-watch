import { describe, expect, it } from "vitest";
import { languageFromQuery, languageLabel, splitByLanguage } from "./languages";

describe("languageFromQuery", () => {
  it("recognises a language typed on its own", () => {
    expect(languageFromQuery("tamil")).toBe("ta");
    expect(languageFromQuery("  Malayalam  ")).toBe("ml");
    expect(languageFromQuery("hindi movies")).toBe("hi");
    expect(languageFromQuery("Korean films")).toBe("ko");
    expect(languageFromQuery("bollywood")).toBe("hi");
    expect(languageFromQuery("tollywood cinema")).toBe("te");
  });

  it("leaves real title searches alone", () => {
    expect(languageFromQuery("english vinglish")).toBeUndefined();
    expect(languageFromQuery("the tamil")).toBeUndefined();
    expect(languageFromQuery("interstellar")).toBeUndefined();
    expect(languageFromQuery("")).toBeUndefined();
  });

  it("labels codes", () => {
    expect(languageLabel("te")).toBe("Telugu");
    expect(languageLabel("de")).toBe("German"); // not a chip: from the built-in list
  });
});

describe("splitByLanguage", () => {
  const kgf = { id: 1, original_language: "kn" };
  const hindi = { id: 2, original_language: "hi" };
  const english = { id: 3, original_language: "en" };

  it("puts the chosen language first and keeps the rest", () => {
    expect(splitByLanguage([kgf, hindi, english], "hi")).toEqual({ primary: [hindi], others: [kgf, english] });
  });

  it("keeps everything as primary with no language picked", () => {
    expect(splitByLanguage([kgf, hindi], undefined)).toEqual({ primary: [kgf, hindi], others: [] });
  });
});
