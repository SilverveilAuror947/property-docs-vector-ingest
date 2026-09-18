import type { PropertyDoc } from "./property_records.ts";

export const SAMPLE_DOCS: PropertyDoc[] = [
  {
    id: "mr-4471",
    unit: "12B",
    kind: "maintenance_request",
    filed_on: "2026-03-02",
    body: "Tenant reports the kitchen sink drains slowly and backs up when the dishwasher runs.\n\nPlumber attended on 3 March, cleared a grease blockage in the trap and advised the tenant not to pour cooking fat down the drain. No parts replaced.",
  },
  {
    id: "td-2210",
    unit: "12B",
    kind: "tenant_document",
    filed_on: "2025-11-15",
    body: "Lease renewal, twelve months from 1 December 2025. Rent is due on the first working day of each month.\n\nAppliance clause: the landlord maintains the dishwasher and oven. Damage caused by misuse, including blocked drains from food waste, is recharged to the tenant.\n\nPets are permitted with written consent; a cleaning deposit applies.",
  },
  {
    id: "ir-0091",
    unit: "12B",
    kind: "inspection_reminder",
    filed_on: "2026-04-10",
    body: "Annual gas safety inspection due 10 April 2026. Notify the tenant at least 24 hours ahead and record the engineer's certificate number against the unit.",
  },
  {
    id: "mr-4488",
    unit: "3A",
    kind: "maintenance_request",
    filed_on: "2026-02-19",
    body: "Bedroom radiator stays cold while the rest of the flat heats normally. Engineer bled the radiator and topped up system pressure; asked the tenant to report again if it recurs within two weeks.",
  },
];
