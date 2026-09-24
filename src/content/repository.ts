/**
 * Content repository. Pages read content only through these async functions,
 * so Phase 2 can replace the static modules with the admin-panel API without
 * changing any component.
 */
import { about } from "./about";
import { certificates } from "./certificates";
import { clients } from "./clients";
import { company } from "./company";
import { contactPage } from "./contact";
import { home } from "./home";
import { industries } from "./industries";
import { legalChrome, legalDocuments } from "./legal";
import { machines } from "./machines";
import { capabilityStatements, metrics } from "./metrics";
import { certificatesPage, clientsPage, industriesPage, servicesPage } from "./pages";
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

/* ---------- Inner pages (stage 1C) ---------- */

export async function getAboutContent() {
  return about;
}

export async function getServicesPageContent() {
  return servicesPage;
}

export async function getIndustriesPageContent() {
  return industriesPage;
}

export async function getClientsPageContent() {
  return clientsPage;
}

export async function getCertificatesPageContent() {
  return certificatesPage;
}

export async function getContactContent() {
  return contactPage;
}

export async function getLegalDocument(slug: keyof typeof legalDocuments) {
  return { document: legalDocuments[slug], chrome: legalChrome };
}
