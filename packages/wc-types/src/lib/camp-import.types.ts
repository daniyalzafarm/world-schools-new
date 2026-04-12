export interface CampImportColumn {
  key: string
  label: string
  description: string
  required: boolean
  type: 'string' | 'number' | 'enum'
  options?: string[]
  example: string
}

export const CAMP_IMPORT_COLUMNS: CampImportColumn[] = [
  {
    key: 'name',
    label: 'Camp Name',
    description:
      'Display name of the camp, shown to parents in search results and listings. Max 120 characters.',
    required: true,
    type: 'string',
    example: 'Chelsea FC Football Academy — Summer Residential',
  },
  {
    key: 'slug',
    label: 'Slug',
    description:
      'URL-friendly camp identifier, auto-generated from the name if omitted. Lowercase letters, digits, and hyphens only (e.g., summer-sports-camp). Must be unique. Max 150 characters.',
    required: false,
    type: 'string',
    example: 'chelsea-fc-football-camp-charterhouse-school',
  },
  {
    key: 'type',
    label: 'Camp Type',
    description:
      "Camp format: 'day' for camps that do not include overnight stays, 'residential' for overnight or boarding camps.",
    required: true,
    type: 'enum',
    options: ['day', 'residential'],
    example: 'residential',
  },
  {
    key: 'description',
    label: 'Description',
    description:
      'Short summary of the camp experience, shown in search results and the camp listing header. Max 500 characters.',
    required: true,
    type: 'string',
    example:
      'An elite residential football camp in partnership with Chelsea FC Academy coaching staff. Players aged 8–17 train twice daily on full-size pitches.',
  },
  {
    key: 'locationType',
    label: 'Location Type',
    description:
      "Where the camp takes place: 'provider' to use the provider's registered address (default), 'different' to specify a separate venue via locationPlaceId.",
    required: false,
    type: 'enum',
    options: ['provider', 'different'],
    example: 'different',
  },
  {
    key: 'locationPlaceId',
    label: 'Location Place ID',
    description:
      "Google Place ID for the camp venue. Required when locationType is 'different'. The backend resolves this to a Google Business Profile, automatically populating the venue name, address, and coordinates. Leave blank when locationType is 'provider' — the camp inherits the provider's Google Business Profile.",
    required: false,
    type: 'string',
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  },
  {
    key: 'locationName',
    label: 'Location Name',
    description:
      'Display name of the camp venue (e.g., Charterhouse School, Surrey). Used as a fallback or override when locationPlaceId is not provided.',
    required: false,
    type: 'string',
    example: 'Charterhouse School, Surrey',
  },
  {
    key: 'locationAddress',
    label: 'Location Address',
    description:
      'Street address of the camp venue. Used as a fallback or override when locationPlaceId is not provided.',
    required: false,
    type: 'string',
    example: 'Lymington Road, Highcliffe, Christchurch BH23 4JS, United Kingdom',
  },
  {
    key: 'ageGroups',
    label: 'Age Groups',
    description:
      'One or more eligible age ranges in min-max format, comma-separated for multiple groups. Each value must be 4–18. Ranges must not overlap. Example: 8-12,13-17 creates two groups; 6-16 creates one.',
    required: true,
    type: 'string',
    example: '8-12,13-17',
  },
  {
    key: 'gender',
    label: 'Gender',
    description:
      "Who the camp is open to: 'coed' for all genders, 'boys' for boys only, 'girls' for girls only.",
    required: true,
    type: 'enum',
    options: ['coed', 'boys', 'girls'],
    example: 'coed',
  },
  {
    key: 'languages',
    label: 'Languages',
    description:
      'Comma-separated list of instruction languages. At least one is required. Options: english, french, german, spanish, italian, portuguese, dutch, chinese.',
    required: true,
    type: 'string',
    example: 'english',
  },
  {
    key: 'activities',
    label: 'Activities',
    description:
      'Comma-separated activity category slugs. At least one is required. Options: sports, languages, arts, adventure, water, environmental, academics, religion, excursions, music.',
    required: true,
    type: 'string',
    example: 'sports',
  },
]
