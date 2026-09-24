/**
 * Content repository. Pages read content only through these async functions,
 * so Phase 2 can replace the static modules with the admin-panel API without
 * changing any component.
 */
import { certificates } from "./certificates";
import { clients } from "./clients";
import { company } from "./company";
import { home } from "./home";
import { industries } from "./industries";
import { machines } from "./machines";
import { capabilityStatements, metrics } from "./metrics";
import { pillars } from "./pillars";
import { processSteps } from "./process";
import { featuredProjects, getProject, projectCategories, projects } from "./projects";
import { getService, services } from "./services";

export async function getCompany() {
  return company;
}

export async function getHomeContent() {
  return home;
}

export async function getServices() {
  return services;
}

export async function getServiceBySlug(slug: string) {
  return getService(slug);
}

export async function getMachines() {
  return machines;
}

export async function getProjects() {
  return projects;
}

export async function getFeaturedProjects() {
  return featuredProjects();
}

export async function getProjectBySlug(slug: string) {
  return getProject(slug);
}

export async function getProjectCategories() {
  return projectCategories;
}

export async function getIndustries() {
  return industries;
}

export async function getClients() {
  return clients;
}

export async function getCertificates() {
  return certificates;
}

export async function getPillars() {
  return pillars;
}

export async function getMetrics() {
  return { metrics, statements: capabilityStatements };
}

export async function getProcessSteps() {
  return processSteps;
}
