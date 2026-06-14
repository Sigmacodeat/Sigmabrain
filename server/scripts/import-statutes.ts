#!/usr/bin/env bun
/**
 * Importiert AT und DE Gesetze aus law-corpus/ in die Brain-DB.
 *
 * Usage:
 *   bun run server/scripts/import-statutes.ts [--no-embed]
 */

import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { importFromContent } from '../src/core/import-file.ts';
import { loadConfig } from '../src/core/config.ts';

const NO_EMBED = Bun.argv.includes('--no-embed');

interface StatuteFile {
  path: string;
  slug: string;
  jurisdiction: 'at' | 'de' | 'ch';
}

const AT_FILES: StatuteFile[] = [
  { path: 'law-corpus/at/abgb.md', slug: 'legal/statutes/at/abgb', jurisdiction: 'at' },
  { path: 'law-corpus/at/ahg.md', slug: 'legal/statutes/at/ahg', jurisdiction: 'at' },
  { path: 'law-corpus/at/bao.md', slug: 'legal/statutes/at/bao', jurisdiction: 'at' },
  { path: 'law-corpus/at/eo.md', slug: 'legal/statutes/at/eo', jurisdiction: 'at' },
  { path: 'law-corpus/at/stgb-at.md', slug: 'legal/statutes/at/stgb', jurisdiction: 'at' },
  { path: 'law-corpus/at/stpo-at.md', slug: 'legal/statutes/at/stpo', jurisdiction: 'at' },
  { path: 'law-corpus/at/ugb.md', slug: 'legal/statutes/at/ugb', jurisdiction: 'at' },
  { path: 'law-corpus/at/zpo-at.md', slug: 'legal/statutes/at/zpo', jurisdiction: 'at' },
];

const DE_FILES: StatuteFile[] = [
  { path: 'law-corpus/de/ao.md', slug: 'legal/statutes/de/ao', jurisdiction: 'de' },
  { path: 'law-corpus/de/bgb.md', slug: 'legal/statutes/de/bgb', jurisdiction: 'de' },
  { path: 'law-corpus/de/estg.md', slug: 'legal/statutes/de/estg', jurisdiction: 'de' },
  { path: 'law-corpus/de/famfg.md', slug: 'legal/statutes/de/famfg', jurisdiction: 'de' },
  { path: 'law-corpus/de/gg.md', slug: 'legal/statutes/de/gg', jurisdiction: 'de' },
  { path: 'law-corpus/de/gmbhg.md', slug: 'legal/statutes/de/gmbhg', jurisdiction: 'de' },
  { path: 'law-corpus/de/hgb.md', slug: 'legal/statutes/de/hgb', jurisdiction: 'de' },
  { path: 'law-corpus/de/inso.md', slug: 'legal/statutes/de/inso', jurisdiction: 'de' },
  { path: 'law-corpus/de/stgb.md', slug: 'legal/statutes/de/stgb', jurisdiction: 'de' },
  { path: 'law-corpus/de/stpo.md', slug: 'legal/statutes/de/stpo', jurisdiction: 'de' },
  { path: 'law-corpus/de/ustg.md', slug: 'legal/statutes/de/ustg', jurisdiction: 'de' },
  { path: 'law-corpus/de/uwg.md', slug: 'legal/statutes/de/uwg', jurisdiction: 'de' },
  { path: 'law-corpus/de/zpo.md', slug: 'legal/statutes/de/zpo', jurisdiction: 'de' },
];

const CH_FILES: StatuteFile[] = [
  { path: 'law-corpus/ch/or.md', slug: 'legal/statutes/ch/or', jurisdiction: 'ch' },
  { path: 'law-corpus/ch/zgb.md', slug: 'legal/statutes/ch/zgb', jurisdiction: 'ch' },
  { path: 'law-corpus/ch/stgb.md', slug: 'legal/statutes/ch/stgb', jurisdiction: 'ch' },
];

async function importStatutes(files: StatuteFile[], engine: any) {
  let imported = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const content = await Bun.file(file.path).text();
      await importFromContent(engine, file.slug, content, { noEmbed: NO_EMBED });
      console.log(`  ✅ ${file.slug} (${(content.length / 1024).toFixed(0)} KB)`);
      imported++;
    } catch (e) {
      errors++;
      console.error(`  ❌ ${file.path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { imported, errors };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SigmaBrain — Gesetze-Import (AT + DE + CH)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Embedding: ${NO_EMBED ? 'übersprungen' : 'aktiv'}`);
  console.log('');

  const gbrainConfig = loadConfig();
  const engine = new PGLiteEngine();
  await engine.connect({ database_path: gbrainConfig?.database_path });
  await engine.initSchema();

  console.log('[AT] Importiere österreichische Gesetze...');
  const atResult = await importStatutes(AT_FILES, engine);
  console.log(`     ${atResult.imported} importiert, ${atResult.errors} Fehler`);
  console.log('');

  console.log('[DE] Importiere deutsche Gesetze...');
  const deResult = await importStatutes(DE_FILES, engine);
  console.log(`     ${deResult.imported} importiert, ${deResult.errors} Fehler`);
  console.log('');

  console.log('[CH] Importiere schweizerische Gesetze...');
  const chResult = await importStatutes(CH_FILES, engine);
  console.log(`     ${chResult.imported} importiert, ${chResult.errors} Fehler`);
  console.log('');

  const total = atResult.imported + deResult.imported + chResult.imported;
  const totalErr = atResult.errors + deResult.errors + chResult.errors;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ZUSAMMENFASSUNG');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`AT: ${atResult.imported} Gesetze`);
  console.log(`DE: ${deResult.imported} Gesetze`);
  console.log(`CH: ${chResult.imported} Gesetze`);
  console.log(`───────────────────────────────────────────────────────────`);
  console.log(`GESAMT: ${total} Gesetze importiert, ${totalErr} Fehler`);
  console.log('');

  if (!NO_EMBED) {
    console.log('✅ Alle Gesetze wurden importiert + embedded.');
  } else {
    console.log('⚠️  Embedding übersprungen. Nachholen mit:');
    console.log('   bun run server/scripts/auto-embed-pending.ts');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
