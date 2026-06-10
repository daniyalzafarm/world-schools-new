/**
 * One-off, idempotent data migration: convert stored language values (legacy
 * lowercase ids like "english" and legacy display names like "English") to the
 * canonical ISO 639-1 code (e.g. "en"). Mirrors the country name→ISO2 migration.
 *
 * Covers: parents.languages, children.languages, children.camp_preferences
 * (languagesSpoken), camps.languages, camps.languagePrograms (selectedLanguages).
 * Custom / unrecognized languages are left untouched, so it is safe to re-run.
 *
 * Run against local + staging (NOT wired into Prisma migrations — pre-production):
 *   npx tsx apps/wc-nest-api/prisma/manual-migrations/2026-06-05-languages-to-iso639.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { LANGUAGE_CODES, LANGUAGES, LEGACY_LANGUAGE_ID_TO_CODE } from '@world-schools/wc-types'
import { type Prisma, PrismaClient } from '../../src/generated/client/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const codeSet = new Set(LANGUAGE_CODES)
const byName = new Map(LANGUAGES.map(language => [language.name.toLowerCase(), language.code]))

/** Normalize one stored value to a canonical code, leaving unknown/custom values as-is. */
const normalize = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  if (codeSet.has(value)) return value // already canonical
  const key = value.trim().toLowerCase()
  return byName.get(key) ?? LEGACY_LANGUAGE_ID_TO_CODE[key] ?? value
}

const normalizeArray = (arr: unknown): { value: string[]; changed: boolean } => {
  const input = Array.isArray(arr) ? (arr as unknown[]) : []
  const value = input.map(normalize) as string[]
  const changed = value.some((v, i) => v !== input[i])
  return { value, changed }
}

async function migrateParents() {
  const rows = await prisma.parent.findMany({ select: { id: true, languages: true } })
  let updated = 0
  for (const row of rows) {
    const { value, changed } = normalizeArray(row.languages)
    if (changed) {
      await prisma.parent.update({ where: { id: row.id }, data: { languages: value } })
      updated++
    }
  }
  console.log(`parents.languages: ${updated}/${rows.length} updated`)
}

async function migrateChildren() {
  const rows = await prisma.children.findMany({
    select: { id: true, languages: true, campPreferences: true },
  })
  let updatedLanguages = 0
  let updatedPrefs = 0
  for (const row of rows) {
    const data: Prisma.ChildrenUpdateInput = {}

    const langs = normalizeArray(row.languages)
    if (langs.changed) {
      data.languages = langs.value
      updatedLanguages++
    }

    const prefs = row.campPreferences as Record<string, unknown> | null
    if (prefs && Array.isArray(prefs.languagesSpoken)) {
      const spoken = normalizeArray(prefs.languagesSpoken)
      if (spoken.changed) {
        data.campPreferences = {
          ...prefs,
          languagesSpoken: spoken.value,
        } as Prisma.InputJsonValue
        updatedPrefs++
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.children.update({ where: { id: row.id }, data })
    }
  }
  console.log(`children.languages: ${updatedLanguages}/${rows.length} updated`)
  console.log(`children.camp_preferences.languagesSpoken: ${updatedPrefs}/${rows.length} updated`)
}

async function migrateCamps() {
  const rows = await prisma.camp.findMany({
    select: { id: true, languages: true, languagePrograms: true },
  })
  let updatedLanguages = 0
  let updatedPrograms = 0
  for (const row of rows) {
    const data: Prisma.CampUpdateInput = {}

    const langs = normalizeArray(row.languages)
    if (langs.changed) {
      data.languages = langs.value
      updatedLanguages++
    }

    const programs = row.languagePrograms as Record<string, unknown> | null
    if (programs && Array.isArray(programs.selectedLanguages)) {
      const selected = normalizeArray(programs.selectedLanguages)
      if (selected.changed) {
        data.languagePrograms = {
          ...programs,
          selectedLanguages: selected.value,
        } as Prisma.InputJsonValue
        updatedPrograms++
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.camp.update({ where: { id: row.id }, data })
    }
  }
  console.log(`camps.languages: ${updatedLanguages}/${rows.length} updated`)
  console.log(`camps.languagePrograms.selectedLanguages: ${updatedPrograms}/${rows.length} updated`)
}

async function main() {
  console.log('Migrating language values to ISO 639-1 codes...')
  await migrateParents()
  await migrateChildren()
  await migrateCamps()
  console.log('Done.')
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
