-- Seed: HVAC (trade=hvac) requirements for NH (state=NH)
-- NOTE: These are "starter templates" for validation / onboarding speed.
-- You should verify accuracy per state later; this is a scaffold for the library + wizard.

insert into public.requirement_templates
  (name, category, description, default_renewal_window_days, country, state, trade, requirement_type, title, issuer, source_url, default_reminder_offsets_days, required_docs, is_active)
values
  (
    'Business Registration / Entity Good Standing',
    'registration',
    'Keep your business entity active and in good standing for contracting work.',
    30,
    'US','NH','hvac','registration',
    'Business Registration / Good Standing',
    'NH Secretary of State',
    null,
    array[30,14,7],
    '{"docs":["Proof of registration","Annual report confirmation (if applicable)"]}'::jsonb,
    true
  ),
  (
    'General Liability Insurance (COI)',
    'insurance',
    'Maintain active general liability coverage; store COI and policy details.',
    30,
    'US','NH','hvac','insurance',
    'General Liability Insurance (COI)',
    'Insurance Carrier',
    null,
    array[60,30,14,7],
    '{"docs":["Certificate of Insurance (COI)","Policy declarations page"]}'::jsonb,
    true
  ),
  (
    'Workers’ Compensation Coverage (if applicable)',
    'insurance',
    'Maintain workers’ comp coverage if you have employees; store proof.',
    30,
    'US','NH','hvac','insurance',
    'Workers’ Compensation Coverage',
    'Insurance Carrier',
    null,
    array[60,30,14,7],
    '{"docs":["COI or proof of coverage","Exemption documentation (if applicable)"]}'::jsonb,
    true
  ),
  (
    'Vehicle / Commercial Auto Insurance (if applicable)',
    'insurance',
    'Maintain commercial auto coverage for work vehicles; store COI.',
    30,
    'US','NH','hvac','insurance',
    'Commercial Auto Insurance',
    'Insurance Carrier',
    null,
    array[60,30,14,7],
    '{"docs":["Auto insurance COI","Policy declarations page"]}'::jsonb,
    true
  ),
  (
    'EPA 608 Technician Certification (for refrigerants)',
    'cert',
    'Ensure technicians handling refrigerants have valid EPA 608 certification and store proof.',
    30,
    'US','NH','hvac','cert',
    'EPA 608 Certification',
    'U.S. EPA / Certifying Org',
    null,
    array[90,30,14,7],
    '{"docs":["EPA 608 card/certificate","Training proof (if available)"]}'::jsonb,
    true
  ),
  (
    'OSHA Safety Training (recommended)',
    'training',
    'Track safety training completion and renewal (company policy).',
    30,
    'US','NH','hvac','training',
    'OSHA Safety Training',
    'OSHA / Training Provider',
    null,
    array[90,30,14,7],
    '{"docs":["Training certificate","Roster/sign-in sheet"]}'::jsonb,
    true
  ),
  (
    'Local Permit Requirements (city/town)',
    'permit',
    'Some towns may require permits or registrations—track locally required docs.',
    30,
    'US','NH','hvac','permit',
    'Local Permits / Registrations',
    'Local Municipality',
    null,
    array[60,30,14,7],
    '{"docs":["Permit forms","Approval letters","Receipts"]}'::jsonb,
    true
  ),
  (
    'Customer Contract Templates / Terms (recommended)',
    'other',
    'Keep standard contract terms handy and up to date for compliance and disputes.',
    30,
    'US','NH','hvac','other',
    'Customer Contract Templates',
    'Company Policy',
    null,
    array[30,14,7],
    '{"docs":["Standard service agreement","Change order template"]}'::jsonb,
    true
  )
on conflict do nothing;

