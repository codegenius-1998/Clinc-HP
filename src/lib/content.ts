import { randomUUID } from "crypto";
import { d1Query } from "./d1";

export type Department = { id: string; name: string };
export type Service = { id: string; department_id: string; name: string };
export type Feature = { id: string; name: string };
export type Target = { id: string; name: string };
export type Section = { id: string; name: string };

// --- Departments (診療科) and their services ---

export async function listDepartments(): Promise<Department[]> {
  return (await d1Query<Department>("SELECT id, name FROM departments ORDER BY name")).results;
}

export async function getDepartment(id: string): Promise<Department | null> {
  const result = await d1Query<Department>("SELECT id, name FROM departments WHERE id = ?", [id]);
  return result.results[0] ?? null;
}

export async function createDepartment(name: string): Promise<string> {
  const id = randomUUID();
  await d1Query("INSERT INTO departments (id, name) VALUES (?, ?)", [id, name]);
  return id;
}

/** Creates a department and, in the same call, any of its services (e.g. from the "new department"
 * modal, where an admin can list services up front instead of adding them one by one afterwards). */
export async function createDepartmentWithServices(name: string, serviceNames: string[]): Promise<void> {
  const departmentId = await createDepartment(name);
  for (const serviceName of serviceNames) {
    await createService(departmentId, serviceName);
  }
}

export async function updateDepartment(id: string, name: string): Promise<void> {
  await d1Query("UPDATE departments SET name = ? WHERE id = ?", [name, id]);
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

export async function updateService(id: string, name: string): Promise<void> {
  await d1Query("UPDATE services SET name = ? WHERE id = ?", [name, id]);
}

export async function deleteService(id: string): Promise<void> {
  await d1Query("DELETE FROM services WHERE id = ?", [id]);
}

// --- Features / Targets (flat tag lookups) ---

export async function listFeatures(): Promise<Feature[]> {
  return (await d1Query<Feature>("SELECT id, name FROM features ORDER BY name")).results;
}

export async function createFeature(name: string): Promise<void> {
  await d1Query("INSERT INTO features (id, name) VALUES (?, ?)", [randomUUID(), name]);
}

export async function updateFeature(id: string, name: string): Promise<void> {
  await d1Query("UPDATE features SET name = ? WHERE id = ?", [name, id]);
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

export async function updateTarget(id: string, name: string): Promise<void> {
  await d1Query("UPDATE targets SET name = ? WHERE id = ?", [name, id]);
}

export async function deleteTarget(id: string): Promise<void> {
  await d1Query("DELETE FROM targets WHERE id = ?", [id]);
}

// --- Sections (flat name-only master) ---

export async function listSections(): Promise<Section[]> {
  return (await d1Query<Section>("SELECT id, name FROM sections ORDER BY name")).results;
}

export async function createSection(name: string): Promise<void> {
  await d1Query("INSERT INTO sections (id, name) VALUES (?, ?)", [randomUUID(), name]);
}

export async function updateSection(id: string, name: string): Promise<void> {
  await d1Query("UPDATE sections SET name = ? WHERE id = ?", [name, id]);
}

export async function deleteSection(id: string): Promise<void> {
  await d1Query("DELETE FROM sections WHERE id = ?", [id]);
}
