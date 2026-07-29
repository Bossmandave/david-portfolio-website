import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VISIBLE_PROJECTS, getVisibleProject } from "@/content/projects";
import { CaseStudy } from "@/modules/work/CaseStudy";

type Params = { params: Promise<{ slug: string }> };

/**
 * Only published work gets a route. A draft is readable while developing and does not
 * exist in a production build — not hidden, not merely unlinked, absent. Generating the
 * page and trusting that nothing links to it leaves it one guessed URL from being read.
 */
export function generateStaticParams() {
  return VISIBLE_PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = getVisibleProject(slug);
  if (!project) return {};

  return {
    title: `${project.title} — David Uchenna Agodi`,
    description: project.summary,
  };
}

export default async function CaseStudyPage({ params }: Params) {
  const { slug } = await params;
  const project = getVisibleProject(slug);
  if (!project) notFound();

  return <CaseStudy project={project} />;
}
