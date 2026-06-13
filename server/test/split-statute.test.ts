import { describe, test, expect } from "bun:test";
import { splitStatute } from "../src/core/legal/split-statute.ts";

const FIXTURE = `---
title: "EStG — Einkommensteuergesetz"
type: "law"
jurisdiction: "de"
abbreviation: "EStG"
version_date: "2026-06-02"
---

## Inhaltsübersicht

§ 1 Steuerpflicht§ 1a ...table of contents noise...

## § 1 — Steuerpflicht

(1) Natürliche Personen, die im Inland einen Wohnsitz haben, sind unbeschränkt
einkommensteuerpflichtig.

## § 1a

(1) Für Staatsangehörige eines Mitgliedstaates der Europäischen Union gilt …

## § 7c — (weggefallen)

## §§ 29 und 30 — (weggefallen)
`;

describe("splitStatute", () => {
  const { meta, sections } = splitStatute(FIXTURE);

  test("parses frontmatter", () => {
    expect(meta.abbreviation).toBe("EStG");
    expect(meta.jurisdiction).toBe("de");
    expect(meta.title).toBe("EStG — Einkommensteuergesetz");
  });

  test("drops frontmatter + Inhaltsübersicht, keeps only § sections", () => {
    expect(sections.length).toBe(4);
    expect(sections.every((s) => !s.body.includes("table of contents noise"))).toBe(true);
  });

  test("extracts ref, slug-safe id and title", () => {
    expect(sections[0]).toMatchObject({ ref: "1", id: "p-1", title: "Steuerpflicht" });
    expect(sections[1]).toMatchObject({ ref: "1a", id: "p-1a", title: "" });
  });

  test("captures the § body without the heading line", () => {
    expect(sections[0].body).toContain("unbeschränkt");
    expect(sections[0].body.startsWith("##")).toBe(false);
  });

  test("handles ranges (§§ 29 und 30) into a single slug id", () => {
    const range = sections.find((s) => s.ref.includes("29"));
    expect(range).toBeDefined();
    expect(range!.id).toBe("p-29-30");
  });

  test("keeps repealed (weggefallen) sections as legitimate answers", () => {
    const repealed = sections.find((s) => s.ref === "7c");
    expect(repealed).toBeDefined();
    expect(repealed!.title).toContain("weggefallen");
  });

  test("ids are unique even on accidental collisions", () => {
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("§ sections carry the § marker", () => {
    expect(sections.every((s) => s.marker === "§")).toBe(true);
  });
});

const ART_FIXTURE = `---
title: "OR — Obligationenrecht"
type: "law"
jurisdiction: "ch"
abbreviation: "OR"
---

# Obligationenrecht (OR) — Schweiz

## Art. 1 Vertragsfreiheit

Zum Abschlusse eines Vertrages ist die übereinstimmende gegenseitige
Willensäusserung der Parteien erforderlich.

## Art. 8 Form des Vertrags

(text …)

## Art 19

(Grundgesetz-style: "Art" without a dot, no title.)
`;

describe("splitStatute — Article-based statutes (CH OR/ZGB, Grundgesetz)", () => {
  const { meta, sections } = splitStatute(ART_FIXTURE);

  test("parses Art. headings (with and without dot)", () => {
    expect(sections.length).toBe(3);
    expect(sections[0]).toMatchObject({ marker: "Art.", ref: "1", id: "art-1", title: "Vertragsfreiheit" });
    expect(sections[1]).toMatchObject({ marker: "Art.", ref: "8", id: "art-8" });
    expect(sections[2]).toMatchObject({ marker: "Art.", ref: "19", id: "art-19" });
  });

  test("ignores the document H1 and frontmatter", () => {
    expect(meta.abbreviation).toBe("OR");
    expect(sections[0].body).not.toContain("Obligationenrecht (OR) — Schweiz");
    expect(sections[0].body).toContain("Willensäusserung");
  });
});
