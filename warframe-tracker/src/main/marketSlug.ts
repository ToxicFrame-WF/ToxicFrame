// @wfcd has no market name for most mods/arcanes; warframe.market lowercases the name,
// drops apostrophes ("Kavat's Grace" -> kavats_grace) and joins the rest with _.
export const slugFromName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
