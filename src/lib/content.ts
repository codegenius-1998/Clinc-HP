import { randomUUID } from "crypto";
import { d1Query } from "./d1";

export type Section = { id: string; name: string };
export type Site = { id: string; name: string; is_template: number; can_sell: number; created_at: string };
export type SiteSection = { id: string; sec_id: string; site_id: string; content: string | null; position: number };
export type SiteSectionWithName = SiteSection & { section_name: string };
export type Department = { id: string; name: string };
export type Service = { id: string; department_id: string; name: string };
export type Feature = { id: string; name: string };
export type Target = { id: string; name: string };

// --- Sections (reusable section types, e.g. "診療科案内", "ご挨拶") ---

export async function listSections(): Promise<Section[]> {
  return (await d1Query<Section>("SELECT id, name FROM sections ORDER BY name")).results;
}

export async function createSection(name: string): Promise<void> {
  await d1Query("INSERT INTO sections (id, name) VALUES (?, ?)", [randomUUID(), name]);
}

export async function deleteSection(id: string): Promise<void> {
  await d1Query("DELETE FROM sections WHERE id = ?", [id]);
}

// --- Sites (both AI-generated clinic sites and reusable templates, distinguished by is_template) ---

export async function listSites(filter?: { isTemplate?: boolean }): Promise<Site[]> {
  if (filter?.isTemplate === undefined) {
    return (await d1Query<Site>("SELECT * FROM sites ORDER BY created_at DESC")).results;
  }
  return (
    await d1Query<Site>("SELECT * FROM sites WHERE is_template = ? ORDER BY created_at DESC", [
      filter.isTemplate ? 1 : 0,
    ])
  ).results;
}

export async function getSite(id: string): Promise<Site | null> {
  const result = await d1Query<Site>("SELECT * FROM sites WHERE id = ?", [id]);
  return result.results[0] ?? null;
}

export async function createSite(name: string, isTemplate: boolean, canSell: boolean): Promise<string> {
  const id = randomUUID();
  await d1Query("INSERT INTO sites (id, name, is_template, can_sell) VALUES (?, ?, ?, ?)", [
    id,
    name,
    isTemplate ? 1 : 0,
    canSell ? 1 : 0,
  ]);
  return id;
}

export async function setSiteCanSell(id: string, canSell: boolean): Promise<void> {
  await d1Query("UPDATE sites SET can_sell = ? WHERE id = ?", [canSell ? 1 : 0, id]);
}

export async function deleteSite(id: string): Promise<void> {
  await d1Query("DELETE FROM sites WHERE id = ?", [id]);
}

// --- Site sections (join table: which sections a site uses, in what order, with what content) ---

export async function listSiteSections(siteId: string): Promise<SiteSectionWithName[]> {
  return (
    await d1Query<SiteSectionWithName>(
      `SELECT site_sections.*, sections.name AS section_name
       FROM site_sections JOIN sections ON sections.id = site_sections.sec_id
       WHERE site_sections.site_id = ?
       ORDER BY site_sections.position`,
      [siteId]
    )
  ).results;
}

export async function addSiteSection(siteId: string, secId: string, content: string, position: number): Promise<void> {
  await d1Query("INSERT INTO site_sections (id, sec_id, site_id, content, position) VALUES (?, ?, ?, ?, ?)", [
    randomUUID(),
    secId,
    siteId,
    content,
    position,
  ]);
}

export async function deleteSiteSection(id: string): Promise<void> {
  await d1Query("DELETE FROM site_sections WHERE id = ?", [id]);
}

// --- Departments (診療科) and their services ---

export async function listDepartments(): Promise<Department[]> {
  return (await d1Query<Department>("SELECT id, name FROM departments ORDER BY name")).results;
}

export async function createDepartment(name: string): Promise<void> {
  await d1Query("INSERT INTO departments (id, name) VALUES (?, ?)", [randomUUID(), name]);
}

export async function deleteDepartment(id: string): Promise<void> {
  await d1Query("DELETE FROM departments WHERE id = ?", [id]);
}

export async function listServices(departmentId?: string): Promise<Service[]> {
  if (!departmentId) {
    return (await d1Query<Service>("SELECT * FROM services ORDER BY name")).results;
  }
  return (
    await d1Query<Service>("SELECT * FROM services WHERE department_id = ? ORDER BY name", [departmentId])
  ).results;
}

export async function createService(departmentId: string, name: string): Promise<void> {
  await d1Query("INSERT INTO services (id, department_id, name) VALUES (?, ?, ?)", [randomUUID(), departmentId, name]);
}

export async function deleteService(id: string): Promise<void> {
  await d1Query("DELETE FROM services WHERE id = ?", [id]);
}

// --- Features / Targets (flat tag lookups; no dedicated admin screen yet, CRUD kept for reuse) ---

export async function listFeatures(): Promise<Feature[]> {
  return (await d1Query<Feature>("SELECT id, name FROM features ORDER BY name")).results;
}

export async function createFeature(name: string): Promise<void> {
  await d1Query("INSERT INTO features (id, name) VALUES (?, ?)", [randomUUID(), name]);
}

export async function deleteFeature(id: string): Promise<void> {
  await d1Query("DELETE FROM features WHERE id = ?", [id]);
}

export async function listTargets(): Promise<Target[]> {
  return (await d1Query<Target>("SELECT id, name FROM targets ORDER BY name")).results;
}

export async function createTarget(name: string): Promise<void> {
  await d1Query("INSERT INTO targets (id, name) VALUES (?, ?)", [randomUUID(), name]);
}

export async function deleteTarget(id: string): Promise<void> {
  await d1Query("DELETE FROM targets WHERE id = ?", [id]);
}
