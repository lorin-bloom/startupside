import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportLoader } from "@/components/ReportLoader";
import { getSample } from "@/data/samples";
import { normalizeDomain } from "@/lib/domain";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const domain = normalizeDomain(decodeURIComponent((await params).domain));
  const sample = domain ? getSample(domain) : null;
  return { title: sample?.company.name ?? domain ?? "Report" };
}

export default async function ReportPage({ params }: Props) {
  const domain = normalizeDomain(decodeURIComponent((await params).domain));
  if (!domain) notFound();
  return <ReportLoader key={domain} domain={domain} initial={getSample(domain)} />;
}
