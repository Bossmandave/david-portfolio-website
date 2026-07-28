import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PROJECTS, getProject } from "@/content/projects";
import { CaseStudy } from "@/modules/work/CaseStudy";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};

  return {
    title: `${project.title} — David Uchenna Agodi`,
    description: project.summary,
  };
}

export default async function CaseStudyPage({ params }: Params) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return <CaseStudy project={project} />;
}
